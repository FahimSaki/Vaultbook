import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/server/db/client";
import { withTenant, type Ctx } from "@/server/db/tenant";
import {
  costHistory,
  products,
  stockMovements,
  priceHistory,
} from "@/server/db/schema";
import { Forbidden, UserError, pgCode } from "@/lib/errors";
import { normalizeCurrency } from "@/lib/money";
import {
  ProductFields,
  ProductInput,
  type ProductDTO,
  type ProductOwnerDTO,
} from "@/lib/schemas";
import { getDek } from "@/server/crypto/dek";
import { decryptCost } from "@/server/crypto/keys";
import { audit, insertCost, insertMovement } from "./stock";

type Row = typeof products.$inferSelect;

const toDTO = (p: Row): ProductDTO => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  categoryId: p.categoryId,
  description: p.description,
  sellPriceCents: p.sellPriceCents,
  currency: p.currency,
  stockOnHand: p.stockOnHand,
  reorderLevel: p.reorderLevel,
  lowStock: p.stockOnHand <= p.reorderLevel,
});

const withCost = (p: ProductDTO, cost: number | null): ProductOwnerDTO => ({
  ...p,
  costCents: cost,
  marginPercent:
    cost != null && p.sellPriceCents > 0
      ? Math.round(((p.sellPriceCents - cost) / p.sellPriceCents) * 1000) / 10
      : null,
});

export async function latestCosts(tx: Db, ctx: Ctx, dek: Buffer) {
  const latest = await tx
    .selectDistinctOn([costHistory.productId], {
      productId: costHistory.productId,
      costEnc: costHistory.costEnc,
    })
    .from(costHistory)
    .orderBy(
      costHistory.productId,
      desc(costHistory.createdAt),
      desc(costHistory.id),
    );

  return new Map(
    latest.map((r) => [
      r.productId,
      decryptCost(dek, ctx.orgId, r.productId, r.costEnc),
    ]),
  );
}

async function attachCosts(tx: Db, ctx: Ctx, dek: Buffer, rows: ProductDTO[]) {
  const costs = await latestCosts(tx, ctx, dek);
  return rows.map((p) => withCost(p, costs.get(p.id) ?? null));
}

export async function listProducts(
  ctx: Ctx,
  f: {
    q?: string;
    lowStock?: boolean;
    categoryId?: string;
    limit?: number;
  } = {},
): Promise<(ProductDTO | ProductOwnerDTO)[]> {
  const dek = ctx.role === "owner" ? await getDek(ctx) : undefined;
  const term = f.q?.trim();
  const like = term ? `%${term.replace(/[\\%_]/g, "\\$&")}%` : undefined;

  return withTenant(
    ctx,
    async (tx) => {
      const rows = await tx
        .select()
        .from(products)
        .where(
          and(
            isNull(products.archivedAt),
            like
              ? or(ilike(products.name, like), ilike(products.sku, like))
              : undefined,
            f.lowStock
              ? sql`${products.stockOnHand} <= ${products.reorderLevel}`
              : undefined,
            f.categoryId ? eq(products.categoryId, f.categoryId) : undefined,
          ),
        )
        .orderBy(asc(products.name))
        .limit(f.limit ?? 200);

      const base = rows.map(toDTO);
      return dek ? attachCosts(tx, ctx, dek, base) : base; // staff never get cost fields
    },
    { write: false },
  );
}

export async function createProduct(ctx: Ctx, raw: unknown) {
  const input = ProductInput.parse(raw);
  const dek = input.costCents != null ? await getDek(ctx) : undefined;

  return withTenant(ctx, async (tx) => {
    try {
      const [p] = await tx
        .insert(products)
        .values({
          orgId: ctx.orgId,
          sku: input.sku,
          name: input.name,
          categoryId: input.categoryId ?? null,
          description: input.description || null,
          sellPriceCents: input.sellPriceCents,
          currency: normalizeCurrency(input.currency),
          reorderLevel: input.reorderLevel,
        })
        .returning(); // the trigger writes the first price_history row

      if (input.initialStock > 0) {
        await insertMovement(
          tx,
          ctx,
          {
            productId: p.id,
            type: "purchase",
            qty: input.initialStock,
            note: "Opening stock",
            unitCostCents: input.costCents,
          },
          dek,
        );
      } else if (input.costCents != null) {
        await insertCost(tx, ctx, dek!, p.id, input.costCents, null);
      }

      await audit(tx, ctx, "product.create", "product", p.id);
      return p;
    } catch (e) {
      if (pgCode(e) === "23505")
        throw new UserError("That SKU already exists.");
      throw e;
    }
  });
}

export async function updateProduct(ctx: Ctx, id: string, raw: unknown) {
  const input = ProductFields.parse(raw);

  return withTenant(ctx, async (tx) => {
    try {
      const [p] = await tx
        .update(products)
        .set({
          sku: input.sku,
          name: input.name,
          categoryId: input.categoryId ?? null,
          description: input.description || null,
          sellPriceCents: input.sellPriceCents,
          currency: normalizeCurrency(input.currency),
          reorderLevel: input.reorderLevel,
        })
        .where(eq(products.id, id))
        .returning();

      if (!p) throw new UserError("Product not found.");
      await audit(tx, ctx, "product.update", "product", p.id);
      return p;
    } catch (e) {
      const code = pgCode(e);
      if (code === "23505") throw new UserError("That SKU already exists.");
      if (code === "42501") throw new Forbidden();
      throw e;
    }
  });
}

export const archiveProduct = (ctx: Ctx, id: string) =>
  withTenant(ctx, async (tx) => {
    await tx
      .update(products)
      .set({ archivedAt: new Date() })
      .where(eq(products.id, id));

    await audit(tx, ctx, "product.archive", "product", id);
  });

export async function getProductDetail(ctx: Ctx, id: string) {
  if (!z.uuid().safeParse(id).success) return null;

  const dek = ctx.role === "owner" ? await getDek(ctx) : undefined;

  return withTenant(
    ctx,
    async (tx) => {
      const [row] = await tx.select().from(products).where(eq(products.id, id));
      if (!row) return null;

      const movements = await tx
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.productId, id))
        .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
        .limit(50);

      const prices = await tx
        .select()
        .from(priceHistory)
        .where(eq(priceHistory.productId, id))
        .orderBy(asc(priceHistory.changedAt), asc(priceHistory.id));

      const costs = dek
        ? (
            await tx
              .select({
                createdAt: costHistory.createdAt,
                costEnc: costHistory.costEnc,
              })
              .from(costHistory)
              .where(eq(costHistory.productId, id))
              .orderBy(asc(costHistory.createdAt), asc(costHistory.id))
          ).map((c) => ({
            t: c.createdAt,
            cost: decryptCost(dek, ctx.orgId, id, c.costEnc),
          }))
        : [];

      // step-line data: carry the last known price and cost forward
      type Ev = { t: Date; price?: number; cost?: number };
      const events: Ev[] = [
        ...prices.map((h): Ev => ({ t: h.changedAt, price: h.priceCents })),
        ...costs.map((c): Ev => ({ t: c.t, cost: c.cost })),
      ].sort((a, b) => a.t.getTime() - b.t.getTime());

      let price: number | undefined;
      let cost: number | undefined;

      const points = events.map((e) => {
        if (e.price !== undefined) price = e.price;
        if (e.cost !== undefined) cost = e.cost;

        return {
          at: e.t.toISOString().slice(0, 10),
          price: price !== undefined ? price / 100 : undefined,
          cost: cost !== undefined ? cost / 100 : undefined,
        };
      });

      const dto = toDTO(row);

      return {
        product: dek ? withCost(dto, costs.at(-1)?.cost ?? null) : dto,
        movements,
        points,
      };
    },
    { write: false },
  );
}
