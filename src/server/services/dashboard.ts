import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { products, stockMovements } from "@/server/db/schema";
import { getDek } from "@/server/crypto/dek";
import { latestCosts } from "./products";

export async function dashboard(ctx: Ctx) {
  const dek = ctx.role === "owner" ? await getDek(ctx) : undefined;
  return withTenant(
    ctx,
    async (tx) => {
      const live = isNull(products.archivedAt);
      const retail = await tx
        .select({
          currency: products.currency,
          value: sql<string>`coalesce(sum(${products.stockOnHand}::bigint * ${products.sellPriceCents}), 0)`,
        })
        .from(products)
        .where(live)
        .groupBy(products.currency);
      const [counts] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          low: sql<number>`(count(*) filter (where ${products.stockOnHand} <= ${products.reorderLevel}))::int`,
        })
        .from(products)
        .where(live);
      const sold = sql<string>`-sum(${stockMovements.qty})`;
      const movers = await tx
        .select({ id: products.id, name: products.name, sold })
        .from(stockMovements)
        .innerJoin(products, eq(products.id, stockMovements.productId))
        .where(
          and(
            eq(stockMovements.type, "sale"),
            gt(stockMovements.createdAt, sql`now() - interval '30 days'`),
          ),
        )
        .groupBy(products.id, products.name)
        .orderBy(desc(sold))
        .limit(5);

      let costValue: { currency: string; cents: number }[] | null = null;
      if (dek) {
        const costs = await latestCosts(tx, ctx, dek);
        const stock = await tx
          .select({
            id: products.id,
            stock: products.stockOnHand,
            currency: products.currency,
          })
          .from(products)
          .where(live);
        const totals = new Map<string, number>();
        for (const p of stock) {
          const c = costs.get(p.id);
          if (c != null)
            totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.stock * c);
        }
        costValue = [...totals].map(([currency, cents]) => ({
          currency,
          cents,
        }));
      }
      return {
        retail: retail.map((r) => ({
          currency: r.currency,
          cents: Number(r.value),
        })),
        costValue,
        productCount: counts.total,
        lowStock: counts.low,
        movers: movers.map((m) => ({
          id: m.id,
          name: m.name,
          sold: Number(m.sold),
        })),
      };
    },
    { write: false },
  );
}
