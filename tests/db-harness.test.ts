import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeTestDb } from "./helpers/db";
import { __setDbForTests } from "@/server/db/client";
import { withTenant } from "@/server/db/tenant";
import { products } from "@/server/db/schema";

let h: Awaited<ReturnType<typeof makeTestDb>>;
beforeAll(async () => {
  h = await makeTestDb();
  __setDbForTests(h.db);
});
afterAll(async () => {
  __setDbForTests(undefined);
  await h.close();
});

describe("test harness", () => {
  it("round-trips a product through withTenant", async () => {
    const [{ id: orgId }] = await h.admin.query<{ id: string }>(
      "INSERT INTO organizations (name, wrapped_dek) VALUES ($1, $2) RETURNING id",
      ["t", Buffer.from([1])],
    );
    const ctx = { userId: "u", orgId, role: "owner" as const };
    await withTenant(ctx, (tx) =>
      tx
        .insert(products)
        .values({ orgId, sku: "A1", name: "Ring", sellPriceCents: 1000 }),
    );
    const rows = await withTenant(ctx, (tx) => tx.select().from(products), {
      write: false,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("A1");
  });
});
