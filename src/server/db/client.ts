import type { Pool } from "pg";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { config, isPortable } from "../config";
import { requireSession } from "../portable/vault";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export const dbSchema = schema;

const g = globalThis as unknown as { __vbPool?: Pool; __vbDb?: Db };

export function getDb(): Db {
  if (g.__vbDb) return g.__vbDb; // hosted cache, or the test seam
  if (isPortable) return requireSession().db; // throws Locked if locked
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not set");

  /* eslint-disable @typescript-eslint/no-require-imports */
  // Loaded lazily so the portable build never touches `pg`.
  const { Pool: PgPool } = require("pg") as typeof import("pg");
  const { drizzle } =
    require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
  /* eslint-enable @typescript-eslint/no-require-imports */

  g.__vbPool = new PgPool({
    connectionString: config.databaseUrl,
    max: config.mode === "cloud" ? 3 : 10,
  });
  g.__vbDb = drizzle(g.__vbPool, { schema }) as unknown as Db;
  return g.__vbDb;
}

export function __setDbForTests(db: Db | undefined) {
  g.__vbDb = db;
}

/** Swaps the active db and returns the previous one, so seeding can put it back. */
export function __swapDb(db: Db | undefined): Db | undefined {
  const prev = g.__vbDb;
  g.__vbDb = db;
  return prev;
}
