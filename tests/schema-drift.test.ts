import { PGlite } from "@electric-sql/pglite";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { it, expect } from "vitest";
import { migrate, portableFilter } from "@/server/db/migrate";
import { pgliteExec } from "@/server/db/pglite-exec";
import * as schema from "@/server/db/schema";

it("drizzle schema matches the migrated database", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  await migrate(pgliteExec(pg), "src/server/db/migrations", portableFilter);
  for (const t of Object.values(schema).filter((x) => is(x, PgTable))) {
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
});
