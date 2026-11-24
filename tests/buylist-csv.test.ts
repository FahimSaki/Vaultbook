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
import { createProduct } from "@/server/services/products";
import { recordMovement } from "@/server/services/stock";
import { listBuyList, receiveBuyItem } from "@/server/services/buylist";
import { commitCsv, exportCsv, parseCsv } from "@/server/services/csv";
import type { Ctx } from "@/server/db/tenant";
import { UserError } from "@/lib/errors";

let dir: string;
let owner: Ctx;
let staff: Ctx;
const count = async (sql: string) =>
  (await getSession()!.pg.query<{ n: number }>(sql)).rows[0].n;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "vb-b-"));
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

describe("buy list", () => {
  it("receiving an auto-suggested item raises stock and closes it", async () => {
    const p = await createProduct(owner, {
      sku: "A1",
      name: "Ring",
      sellPriceCents: 1000,
      reorderLevel: 2,
      initialStock: 3,
    });
    await recordMovement(owner, { productId: p.id, type: "sale", qty: 2 }); // 1 left, suggests 3
    const [item] = await listBuyList(owner, "open");
    expect(item.qty).toBe(3);
    await receiveBuyItem(owner, item.id, 3);
    expect(await listBuyList(owner, "open")).toHaveLength(0);
    expect(await count("SELECT stock_on_hand AS n FROM products")).toBe(4);
  });
});

describe("csv", () => {
  it("reports row-numbered errors", () => {
    const r = parseCsv(
      "sku,name,price,stock\nA,Ring,10,1\n,Bad,10,1\nB,Chain,abc,1\nA,Dup,5,1",
    );
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5]);
  });

  it("imports nothing if any row conflicts", async () => {
    await createProduct(owner, {
      sku: "X",
      name: "Existing",
      sellPriceCents: 100,
    });
    const { rows } = parseCsv("sku,name,price\nN1,New,5\nX,Clash,5");
    await expect(commitCsv(owner, rows)).rejects.toThrow(UserError);
    expect(
      await count("SELECT count(*)::int AS n FROM products WHERE sku='N1'"),
    ).toBe(0);
  });

  it("owner export has cost, staff export does not, formulas are neutralised", async () => {
    await createProduct(owner, {
      sku: "A1",
      name: "=SUM(A1)",
      sellPriceCents: 1000,
      initialStock: 1,
      costCents: 600,
    });
    const o = await exportCsv(owner);
    expect(o).toContain("cost");
    expect(o).toContain("'=SUM(A1)");
    expect(await exportCsv(staff)).not.toContain("cost");
  });
});
