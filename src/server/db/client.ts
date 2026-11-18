import { Pool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
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
  g.__vbPool = new Pool({ connectionString: config.databaseUrl, max: 10 });
  g.__vbDb = drizzlePg(g.__vbPool, { schema }) as unknown as Db;
  return g.__vbDb;
}

export function __setDbForTests(db: Db | undefined) {
  g.__vbDb = db;
}
