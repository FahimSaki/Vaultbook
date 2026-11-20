import type { PGlite } from "@electric-sql/pglite";
import type { SqlExec } from "./migrate";

export const pgliteExec = (pg: PGlite): SqlExec => ({
  exec: async (s) => {
    await pg.exec(s);
  },
  query: async <T = unknown>(s: string, p?: unknown[]) =>
    (await pg.query<T>(s, p)).rows,
});
