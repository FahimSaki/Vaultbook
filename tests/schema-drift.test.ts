import { PGlite } from "@electric-sql/pglite";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, it, expect } from "vitest";
import { migrate, portableFilter } from "@/server/db/migrate";
import { pgliteExec } from "@/server/db/pglite-exec";
import * as schema from "@/server/db/schema";

describe("drizzle schema", () => {
  it("has exactly the columns the migrations create", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await migrate(pgliteExec(pg), "src/server/db/migrations", portableFilter);
    const tables = Object.values(schema).filter((x) => is(x, PgTable));
    expect(tables.length).toBeGreaterThan(5);
    for (const t of tables) {
      const name = getTableName(t);
      const want = Object.values(getTableColumns(t))
        .map((c) => c.name)
        .sort();
      const { rows } = await pg.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [name],
      );
      expect(rows.map((r) => r.column_name).sort(), name).toEqual(want);
    }
    await pg.close();
  });
});
