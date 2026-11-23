import { PGlite } from "@electric-sql/pglite";
import { describe, it, expect } from "vitest";
import { migrate, portableFilter, type SqlExec } from "@/server/db/migrate";
import { normalizeCurrency, formatMoney, DEFAULT_CURRENCY } from "@/lib/money";
import { UserError } from "@/lib/errors";

const DIR = "src/server/db/migrations";
const wrap = (pg: PGlite): SqlExec => ({
  exec: async (s) => {
    await pg.exec(s);
  },
  query: async <T = unknown>(s: string, p?: unknown[]) =>
    (await pg.query<T>(s, p)).rows,
});

async function fresh(include = portableFilter) {
  const pg = new PGlite();
  await pg.waitReady;
  await migrate(wrap(pg), DIR, include);
  const org = (
    await pg.query<{ id: string }>(
      "INSERT INTO organizations (name, wrapped_dek) VALUES ('t', $1) RETURNING id",
      [new Uint8Array([1])],
    )
  ).rows[0].id;
  return { pg, org };
}

const addProduct = async (pg: PGlite, org: string, sku: string, cur?: string) =>
  (
    await (cur
      ? pg.query<{ id: string }>(
          "INSERT INTO products (org_id, sku, name, sell_price_cents, currency) VALUES ($1,$2,$2,1000,$3) RETURNING id",
          [org, sku, cur],
        )
      : pg.query<{ id: string }>(
          "INSERT INTO products (org_id, sku, name, sell_price_cents) VALUES ($1,$2,$2,1000) RETURNING id",
          [org, sku],
        ))
  ).rows[0].id;

const history = async (pg: PGlite, id: string) =>
  (
    await pg.query<{ price_cents: number; currency: string }>(
      "SELECT price_cents, currency FROM price_history WHERE product_id=$1 ORDER BY id",
      [id],
    )
  ).rows;

describe("normalizeCurrency", () => {
  it("defaults to BDT when blank or missing", () => {
    expect(normalizeCurrency("")).toBe(DEFAULT_CURRENCY);
    expect(normalizeCurrency("  ")).toBe("BDT");
    expect(normalizeCurrency(undefined)).toBe("BDT");
    expect(normalizeCurrency(null)).toBe("BDT");
  });
  it("accepts real codes in any case", () => {
    expect(normalizeCurrency(" usd ")).toBe("USD");
    expect(normalizeCurrency("EUR")).toBe("EUR");
  });
  it("rejects junk", () => {
    for (const bad of ["US", "USDD", "12A", "ZZZ"]) {
      expect(() => normalizeCurrency(bad)).toThrow(UserError);
    }
  });
  it("formats with the product's currency", () => {
    expect(formatMoney(12345, "USD")).toContain("123.45");
    expect(formatMoney(12345)).toContain("123.45");
  });
});

describe("0003_currency on PGlite", () => {
  it("defaults to BDT and keeps an explicit currency", async () => {
    const { pg, org } = await fresh();
    const a = await addProduct(pg, org, "A");
    const b = await addProduct(pg, org, "B", "USD");
    expect(await history(pg, a)).toEqual([
      { price_cents: 1000, currency: "BDT" },
    ]);
    expect(await history(pg, b)).toEqual([
      { price_cents: 1000, currency: "USD" },
    ]);
  });

  it("rejects malformed codes at the database", async () => {
    const { pg, org } = await fresh();
    await expect(addProduct(pg, org, "A", "usd")).rejects.toThrow(
      /check constraint/,
    );
    await expect(addProduct(pg, org, "B", "US")).rejects.toThrow(
      /check constraint/,
    );
  });

  it("logs a history row when only the currency changes", async () => {
    const { pg, org } = await fresh();
    const id = await addProduct(pg, org, "A");
    await pg.query("UPDATE products SET currency='USD' WHERE id=$1", [id]);
    expect(await history(pg, id)).toEqual([
      { price_cents: 1000, currency: "BDT" },
      { price_cents: 1000, currency: "USD" },
    ]);
  });

  it("does not log when neither price nor currency changes", async () => {
    const { pg, org } = await fresh();
    const id = await addProduct(pg, org, "A");
    await pg.query("UPDATE products SET name='New' WHERE id=$1", [id]);
    expect(await history(pg, id)).toHaveLength(1);
  });

  it("upgrades an old vault: existing products become BDT", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await migrate(wrap(pg), DIR, (f) => f.startsWith("0001")); // the old schema
    const org = (
      await pg.query<{ id: string }>(
        "INSERT INTO organizations (name, wrapped_dek) VALUES ('t', $1) RETURNING id",
        [new Uint8Array([1])],
      )
    ).rows[0].id;
    const id = (
      await pg.query<{ id: string }>(
        "INSERT INTO products (org_id, sku, name, sell_price_cents) VALUES ($1,'OLD','Old',500) RETURNING id",
        [org],
      )
    ).rows[0].id;
    expect(await migrate(wrap(pg), DIR, portableFilter)).toEqual([
      "0003_currency.sql",
    ]);
    const p = (
      await pg.query<{ currency: string }>(
        "SELECT currency FROM products WHERE id=$1",
        [id],
      )
    ).rows[0];
    expect(p.currency).toBe("BDT");
    expect(await history(pg, id)).toEqual([
      { price_cents: 500, currency: "BDT" },
    ]);
  });
});
