import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "@/server/config";
import {
  createVault,
  lockVault,
  getSession,
  __resetThrottleForTests,
} from "@/server/portable/vault";
import {
  createProduct,
  listProducts,
  updateProduct,
} from "@/server/services/products";
import { recordMovement } from "@/server/services/stock";
import type { Ctx } from "@/server/db/tenant";
import { UserError } from "@/lib/errors";

let dir: string;
let owner: Ctx;
let staff: Ctx;
const count = async (sql: string) =>
  (await getSession()!.pg.query<{ n: number }>(sql)).rows[0].n;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "vb-svc-"));
  config.dataDir = dir;
  __resetThrottleForTests();
  await createVault("correct horse battery", "Shop");
  owner = { userId: "owner", orgId: getSession()!.orgId, role: "owner" };
  staff = { ...owner, role: "staff" };
});
afterEach(async () => {
  await lockVault().catch(() => {});
  await fs.rm(dir, { recursive: true, force: true });
});

const make = (o: Partial<Record<string, unknown>> = {}) =>
  createProduct(owner, {
    sku: "A1",
    name: "Ring",
    sellPriceCents: 1000,
    reorderLevel: 2,
    initialStock: 5,
    costCents: 600,
    ...o,
  });

describe("services", () => {
  it("owner sees cost and margin, staff never get cost fields", async () => {
    await make();
    const [o] = await listProducts(owner);
    expect(o).toMatchObject({
      stockOnHand: 5,
      costCents: 600,
      marginPercent: 40,
    });
    const [s] = await listProducts(staff);
    expect("costCents" in s).toBe(false);
  });

  it("rejects overselling and duplicate SKUs", async () => {
    const p = await make();
    await expect(
      recordMovement(owner, { productId: p.id, type: "sale", qty: 6 }),
    ).rejects.toThrow(UserError);
    await expect(make()).rejects.toThrow(/SKU already exists/);
  });

  it("logs price changes", async () => {
    const p = await make();
    await updateProduct(owner, p.id, {
      sku: "A1",
      name: "Ring",
      sellPriceCents: 1500,
      reorderLevel: 2,
    });
    expect(await count("SELECT count(*)::int AS n FROM price_history")).toBe(2);
  });

  it("suggests the buy list once", async () => {
    const p = await make();
    await recordMovement(owner, { productId: p.id, type: "sale", qty: 3 }); // 2 left
    await recordMovement(owner, { productId: p.id, type: "sale", qty: 1 }); // 1 left
    expect(
      await count(
        "SELECT count(*)::int AS n FROM buy_list_items WHERE status='open'",
      ),
    ).toBe(1);
  });

  it("two parallel sales of the last unit: exactly one succeeds", async () => {
    const p = await make({ sku: "R1", initialStock: 1, costCents: null });
    const sale = () =>
      recordMovement(owner, { productId: p.id, type: "sale", qty: 1 });
    const r = await Promise.allSettled([sale(), sale()]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });
});
