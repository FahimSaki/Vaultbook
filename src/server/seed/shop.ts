import sharp from "sharp";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { priceHistory, stockMovements } from "@/server/db/schema";
import { createProduct } from "@/server/services/products";
import { addCategory, listCategories } from "@/server/services/categories";
import { createImageRow } from "@/server/services/images";
import { getDek } from "@/server/crypto/dek";
import { getStore } from "@/server/storage";

const CATALOG: Record<string, string[]> = {
  Rings: [
    "Plain band",
    "Signet",
    "Solitaire",
    "Twist",
    "Stacking",
    "Cocktail",
    "Eternity",
    "Knot",
  ],
  Necklaces: [
    "Chain",
    "Pendant",
    "Choker",
    "Locket",
    "Layered",
    "Pearl strand",
    "Bar",
    "Charm",
  ],
  Earrings: [
    "Stud",
    "Hoop",
    "Drop",
    "Huggie",
    "Cluster",
    "Threader",
    "Climber",
    "Dangle",
  ],
  Bracelets: [
    "Bangle",
    "Cuff",
    "Tennis",
    "Chain link",
    "Charm",
    "Beaded",
    "Wrap",
    "Slider",
  ],
};
const DAY = 86_400_000;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function placeholderPhoto(hue: number, n: number) {
  const fill = `hsl(${hue},45%,55%)`;
  const shape =
    n % 3 === 0
      ? `<circle cx='400' cy='380' r='${140 + (n % 5) * 12}' fill='${fill}'/>`
      : n % 3 === 1
        ? `<rect x='230' y='230' width='340' height='340' rx='60' fill='${fill}'/>`
        : `<polygon points='400,200 600,560 200,560' fill='${fill}'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'><rect width='100%' height='100%' fill='hsl(${hue},40%,85%)'/>${shape}</svg>`;
  const img = sharp(Buffer.from(svg));
  return {
    full: await img.clone().webp({ quality: 80 }).toBuffer(),
    thumb: await img.clone().resize(256, 256).webp({ quality: 75 }).toBuffer(),
  };
}

/**
 * Fills one shop with ~32 fake products, placeholder photos and 6 months of history.
 * Everything runs through the normal services as the owner, so RLS applies exactly as in production.
 * Back-dated rows are plain INSERTs with explicit timestamps: price_history inserts never fire
 * the products trigger, and the stock trigger keeps cached stock consistent (purchases go in first).
 */
export async function seedShop(ctx: Ctx, opts: { photos?: boolean } = {}) {
  const rng = mulberry32(42);
  const int = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));

  for (const name of Object.keys(CATALOG)) await addCategory(ctx, name);
  const cats = new Map((await listCategories(ctx)).map((c) => [c.name, c.id]));

  const made: { id: string; price: number }[] = [];
  let n = 0;
  for (const [category, styles] of Object.entries(CATALOG)) {
    for (const style of styles) {
      const price = int(1500, 60000) * 100;
      const p = await createProduct(ctx, {
        sku: "DEMO-" + String(n + 1).padStart(4, "0"),
        name: `${style} ${category.slice(0, -1).toLowerCase()}`,
        categoryId: cats.get(category),
        description: "Demo item. Fake data.",
        sellPriceCents: price,
        reorderLevel: 3,
        initialStock: n % 7 === 0 ? 2 : int(4, 14),
        costCents: Math.round((price * (0.5 + rng() * 0.2)) / 100) * 100,
      });
      made.push({ id: p.id, price });
      n++;
    }
  }

  if (opts.photos !== false) {
    const store = getStore(await getDek(ctx));
    for (let i = 0; i < made.length; i += 8) {
      await Promise.all(
        made.slice(i, i + 8).map(async (m, j) => {
          const row = await createImageRow(ctx, m.id);
          if (!row) return;
          const { full, thumb } = await placeholderPhoto(
            ((i + j) * 37) % 360,
            i + j,
          );
          await store.put(row.storageKey, full, "image/webp");
          await store.put(row.thumbKey, thumb, "image/webp");
        }),
      );
    }
  }

  const now = Date.now();
  const ago = (d: number) => new Date(now - d * DAY);
  const prices: (typeof priceHistory.$inferInsert)[] = [];
  const purchases: (typeof stockMovements.$inferInsert)[] = [];
  const sales: (typeof stockMovements.$inferInsert)[] = [];
  for (const p of made) {
    const steps = int(2, 4);
    const days = Array.from({ length: steps }, () => int(20, 175)).sort(
      (a, b) => b - a,
    );
    days.forEach((d, i) => {
      prices.push({
        orgId: ctx.orgId,
        productId: p.id,
        priceCents:
          Math.round((p.price * (0.8 + (0.2 * i) / steps)) / 100) * 100,
        changedBy: "seed",
        changedAt: ago(d),
      });
    });
    purchases.push({
      orgId: ctx.orgId,
      productId: p.id,
      type: "purchase",
      qty: 30,
      note: "Seed stock",
      createdBy: "seed",
      createdAt: ago(176),
    });
    for (let k = int(3, 8); k > 0; k--)
      sales.push({
        orgId: ctx.orgId,
        productId: p.id,
        type: "sale",
        qty: -int(1, 3),
        note: "Seed sale",
        createdBy: "seed",
        createdAt: ago(int(1, 170)),
      });
  }
  await withTenant(ctx, async (tx) => {
    await tx.insert(priceHistory).values(prices);
    await tx.insert(stockMovements).values(purchases); // before the sales, so stock never dips below zero
    await tx.insert(stockMovements).values(sales);
  });
  return made.length;
}
