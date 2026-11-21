import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { migrate, portableFilter, type SqlExec } from "@/server/db/migrate";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/client";

export const driver = (process.env.DB_DRIVER ?? "pglite") as "pglite" | "pg";
const DIR = "src/server/db/migrations";

const urlFor = (base: string, dbName: string) => {
  const u = new URL(base);
  u.pathname = "/" + dbName;
  return u.toString();
};

export async function makeTestDb() {
  if (driver === "pglite") {
    const pg = new PGlite();
    await pg.waitReady;
    const admin: SqlExec = {
      exec: async (s) => {
        await pg.exec(s);
      },
      query: async <T = unknown>(s: string, p?: unknown[]) =>
        (await pg.query<T>(s, p)).rows,
    };
    await migrate(admin, DIR, portableFilter);
    return {
      db: drizzlePglite(pg, { schema }) as unknown as Db,
      admin, // privileged handle, for seeding orgs etc.
      close: () => pg.close(),
      driver,
    };
  }

  // pg: fresh database per test file, migrated as owner, queried as vb_app
  const ownerUrl = process.env.MIGRATION_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!ownerUrl || !appUrl)
    throw new Error("Set MIGRATION_DATABASE_URL and DATABASE_URL");

  const name = "vb_test_" + randomBytes(4).toString("hex");
  const adminPool = new Pool({
    connectionString: urlFor(ownerUrl, "postgres"),
    max: 1,
  });
  await adminPool.query("CREATE DATABASE " + name);

  const owner = new Pool({ connectionString: urlFor(ownerUrl, name), max: 2 });
  const admin: SqlExec = {
    exec: async (s) => {
      await owner.query(s);
    },
    query: async <T = unknown>(s: string, p?: unknown[]) =>
      (await owner.query(s, p)).rows as T[],
  };
  await migrate(admin, DIR);

  const app = new Pool({ connectionString: urlFor(appUrl, name), max: 5 });
  return {
    db: drizzlePg(app, { schema }) as unknown as Db,
    admin,
    close: async () => {
      await app.end();
      await owner.end();
      await adminPool.query("DROP DATABASE " + name);
      await adminPool.end();
    },
    driver,
  };
}
