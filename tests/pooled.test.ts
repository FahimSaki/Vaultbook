/**
 * Proves set_config(..., true) is safe behind a transaction pooler (Neon's "-pooler" URL).
 * Skipped unless POOLED_DATABASE_URL is set. Point it at a THROWAWAY Neon branch (not the demo):
 * vb_app cannot delete what this test creates.
 *
 *   POOLED_DATABASE_URL='postgres://vb_app:...@ep-xxx-pooler.../neondb?sslmode=require' pnpm vitest run tests/pooled.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/server/db/schema";
import { __setDbForTests, type Db } from "@/server/db/client";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { memberships, organizations, products } from "@/server/db/schema";

const url = process.env.POOLED_DATABASE_URL;

describe.runIf(!!url)("pooled connection: tenant settings never leak", () => {
  let pool: Pool;
  let a: Ctx;
  let b: Ctx;

  const makeShop = async (tag: string): Promise<Ctx> => {
    const orgId = randomUUID();
    const ctx: Ctx = {
      userId: `pool-${tag}-${orgId.slice(0, 8)}`,
      orgId,
      role: "owner",
    };
    await withTenant(ctx, async (tx) => {
      await tx
        .insert(organizations)
        .values({ id: orgId, name: tag, wrappedDek: Buffer.from([1]) });
      await tx
        .insert(memberships)
        .values({ userId: ctx.userId, orgId, role: "owner" });
      await tx
        .insert(products)
        .values({ orgId, sku: `P-${tag}`, name: tag, sellPriceCents: 100 });
    });
    return ctx;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 10 });
    __setDbForTests(drizzle(pool, { schema }) as unknown as Db);
    a = await makeShop("A");
    b = await makeShop("B");
  });
  afterAll(async () => {
    __setDbForTests(undefined);
    await pool.end();
  });

  it("60 interleaved parallel reads each see only their own shop", async () => {
    const jobs = Array.from({ length: 60 }, (_, i) => {
      const ctx = i % 2 ? a : b;
      return withTenant(
        ctx,
        (tx) => tx.select({ sku: products.sku }).from(products),
        { write: false },
      ).then((rows) => ({
        want: i % 2 ? "P-A" : "P-B",
        got: rows.map((r) => r.sku),
      }));
    });
    for (const r of await Promise.all(jobs)) expect(r.got).toEqual([r.want]);
  });

  it("no tenant setting survives outside a transaction", async () => {
    for (let i = 0; i < 30; i++) {
      const { rows } = await pool.query(
        "SELECT current_setting('app.org_id', true) AS v",
      );
      expect(rows[0].v ?? "").toBe("");
    }
  });
});
