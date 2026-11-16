import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect } from 'vitest';
import { migrate, portableFilter, type SqlExec } from '@/server/db/migrate';

const DIR = 'src/server/db/migrations';
const wrap = (pg: PGlite): SqlExec => ({
  exec: async (s) => {
    await pg.exec(s);
  },
  query: async <T = unknown>(s: string, p?: unknown[]) =>
    (await pg.query<T>(s, p)).rows,
});

async function fresh() {
  const pg = new PGlite();
  await pg.waitReady;
  await migrate(wrap(pg), DIR, portableFilter);
  const org = (await pg.query<{ id: string }>(
    'INSERT INTO organizations (name, wrapped_dek) VALUES ($1, $2) RETURNING id',
    ['t', new Uint8Array([1])],
  )).rows[0].id;
  const prod = (await pg.query<{ id: string }>(
    'INSERT INTO products (org_id, sku, name, sell_price_cents) VALUES ($1, $2, $3, $4) RETURNING id',
    [org, 'A1', 'Ring', 1000],
  )).rows[0].id;
  return { pg, org, prod };
}
const move = (pg: PGlite, org: string, prod: string, type: string, qty: number) =>
  pg.query(
    'INSERT INTO stock_movements (org_id, product_id, type, qty, created_by) VALUES ($1,$2,$3,$4,$5)',
    [org, prod, type, qty, 'u'],
  );

describe('0001_core on PGlite', () => {
  it('is idempotent', async () => {
    const { pg } = await fresh();
    expect(await migrate(wrap(pg), DIR, portableFilter)).toEqual([]);
  });

  it('keeps cached stock in sync and blocks overselling', async () => {
    const { pg, org, prod } = await fresh();
    await move(pg, org, prod, 'purchase', 5);
    await move(pg, org, prod, 'sale', -2);
    const s = (await pg.query<{ stock_on_hand: number }>('SELECT stock_on_hand FROM products WHERE id=$1', [prod])).rows[0];
    expect(s.stock_on_hand).toBe(3);
    await expect(move(pg, org, prod, 'sale', -4)).rejects.toThrow(/check constraint/);
  });

  it('logs price changes and forbids editing history', async () => {
    const { pg, org, prod } = await fresh();
    await pg.query('UPDATE products SET sell_price_cents = 1500 WHERE id = $1', [prod]);
    const n = (await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM price_history WHERE product_id=$1', [prod])).rows[0].n;
    expect(n).toBe(2); // insert + update
    await move(pg, org, prod, 'purchase', 1);
    await expect(pg.query("UPDATE stock_movements SET note = 'x'")).rejects.toThrow(/append-only/);
    await expect(pg.query('DELETE FROM price_history')).rejects.toThrow(/append-only/);
  });
});