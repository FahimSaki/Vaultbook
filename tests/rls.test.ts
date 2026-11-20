import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeTestDb, driver } from "./helpers/db";
import { __setDbForTests } from "@/server/db/client";
import { withTenant, type Ctx } from "@/server/db/tenant";
import {
  products,
  stockMovements,
  costHistory,
  memberships,
} from "@/server/db/schema";
import { pgCode } from "@/lib/errors";

describe.runIf(driver === "pg")("row-level security (as vb_app)", () => {
  let h: Awaited<ReturnType<typeof makeTestDb>>;
  let ownerA: Ctx, staffA: Ctx, ownerB: Ctx;
  let productId: string;

  const newOrg = async (name: string) =>
    (
      await h.admin.query<{ id: string }>(
        "INSERT INTO organizations (name, wrapped_dek) VALUES ($1, $2) RETURNING id",
        [name, Buffer.from([1])],
      )
    )[0].id;

  const newProduct = async (ctx: Ctx, sku: string, stock = 0) => {
    const [p] = await withTenant(ctx, (tx) =>
      tx
        .insert(products)
        .values({ orgId: ctx.orgId, sku, name: sku, sellPriceCents: 1000 })
        .returning(),
    );
    if (stock > 0)
      await withTenant(ctx, (tx) =>
        tx.insert(stockMovements).values({
          orgId: ctx.orgId,
          productId: p.id,
          type: "purchase",
          qty: stock,
          createdBy: ctx.userId,
        }),
      );
    return p.id;
  };

  const sale = (ctx: Ctx, pid: string, qty: number) =>
    withTenant(ctx, (tx) =>
      tx.insert(stockMovements).values({
        orgId: ctx.orgId,
        productId: pid,
        type: "sale",
        qty: -qty,
        createdBy: ctx.userId,
      }),
    );

  beforeAll(async () => {
    h = await makeTestDb();
    __setDbForTests(h.db);
    const a = await newOrg("A");
    const b = await newOrg("B");
    ownerA = { userId: "oa", orgId: a, role: "owner" };
    staffA = { userId: "sa", orgId: a, role: "staff" };
    ownerB = { userId: "ob", orgId: b, role: "owner" };
    await h.admin.query(
      "INSERT INTO memberships (user_id, org_id, role) VALUES ('oa',$1,'owner'),('sa',$1,'staff')",
      [a],
    );
    productId = await newProduct(ownerA, "A1");
    await withTenant(ownerA, (tx) =>
      tx
        .insert(costHistory)
        .values({ orgId: a, productId, costEnc: Buffer.from([1, 2, 3]) }),
    );
  });
  afterAll(async () => {
    __setDbForTests(undefined);
    await h.close();
  });

  it("shop B sees none of shop A's products", async () => {
    const rows = await withTenant(ownerB, (tx) => tx.select().from(products), {
      write: false,
    });
    expect(rows).toHaveLength(0);
  });

  it("staff cannot read or write cost_history; owner can read", async () => {
    expect(
      await withTenant(staffA, (tx) => tx.select().from(costHistory), {
        write: false,
      }),
    ).toHaveLength(0);
    await expect(
      withTenant(staffA, (tx) =>
        tx
          .insert(costHistory)
          .values({
            orgId: staffA.orgId,
            productId,
            costEnc: Buffer.from([9]),
          }),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
    expect(
      await withTenant(ownerA, (tx) => tx.select().from(costHistory), {
        write: false,
      }),
    ).toHaveLength(1);
  });

  it("staff cannot change selling prices", async () => {
    await expect(
      withTenant(staffA, (tx) =>
        tx.update(products).set({ sellPriceCents: 1 }),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });

  it("nobody can update or delete stock movements", async () => {
    const pid = await newProduct(ownerA, "H1", 2);
    for (const ctx of [ownerA, staffA]) {
      await expect(
        withTenant(ctx, (tx) => tx.update(stockMovements).set({ note: "x" })),
      ).rejects.toThrow();
      await expect(
        withTenant(ctx, (tx) => tx.delete(stockMovements)),
      ).rejects.toThrow();
    }
    expect(pid).toBeTruthy();
  });

  it("selling more than stock fails with a check violation", async () => {
    const pid = await newProduct(ownerA, "S1", 2);
    await expect(sale(ownerA, pid, 3)).rejects.toSatisfy(
      (e) => pgCode(e) === "23514",
    );
  });

  it("two parallel sales of the last unit: exactly one succeeds", async () => {
    const pid = await newProduct(ownerA, "RACE", 1);
    const results = await Promise.allSettled([
      sale(ownerA, pid, 1),
      sale(ownerA, pid, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("staff cannot update or delete memberships; owner cannot delete the owner", async () => {
    const up = await withTenant(staffA, (tx) =>
      tx.update(memberships).set({ role: "owner" }).returning(),
    );
    expect(up).toHaveLength(0);
    const del = await withTenant(staffA, (tx) =>
      tx.delete(memberships).returning(),
    );
    expect(del).toHaveLength(0);
    const delOwner = await withTenant(ownerA, (tx) =>
      tx.delete(memberships).returning(),
    );
    expect(delOwner.every((m) => m.role === "staff")).toBe(true);
  });
});
