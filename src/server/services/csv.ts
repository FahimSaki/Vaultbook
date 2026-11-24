import Papa from "papaparse";
import { z } from "zod";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { categories, products } from "@/server/db/schema";
import { UserError } from "@/lib/errors";
import { normalizeCurrency, toCents } from "@/lib/money";
import { getDek } from "@/server/crypto/dek";
import { audit, insertCost, insertMovement } from "./stock";
import { listProducts } from "./products";
import { listCategories } from "./categories";

const ok = (fn: () => unknown) => () => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};
const money = (v: string) => ok(() => toCents(v))();
const cur = (v: string) => ok(() => normalizeCurrency(v))();

const CsvRow = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(64),
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.string().trim().max(100).optional(),
  currency: z.string().trim().refine(cur, "Unknown currency").optional(),
  price: z.string().trim().refine(money, "Invalid price"),
  stock: z.coerce.number().int().min(0).default(0),
  reorder_level: z.coerce.number().int().min(0).default(0),
  cost: z.string().trim().refine(money, "Invalid cost").optional(),
});
export type CsvRowT = z.infer<typeof CsvRow>;
export type CsvLine = CsvRowT & { line: number };
export type CsvPreview = {
  count: number;
  errors: { row: number; message: string }[];
  error?: string;
};

export function parseCsv(input: string) {
  const text = input.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (parsed.data.length > 5000) throw new UserError("Maximum 5,000 rows.");
  const rows: CsvLine[] = [];
  const errors: { row: number; message: string }[] = [];
  const seen = new Set<string>();
  parsed.data.forEach((raw, i) => {
    const line = i + 2; // header is line 1
    const clean = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        typeof v === "string" && v.trim() === "" ? undefined : v,
      ]),
    );
    const r = CsvRow.safeParse(clean);
    if (!r.success) {
      const issue = r.error.issues[0];
      errors.push({
        row: line,
        message: `${issue.message} (${issue.path.join(".") || "row"})`,
      });
      return;
    }
    if (seen.has(r.data.sku)) {
      errors.push({ row: line, message: "Duplicate SKU in file" });
      return;
    }
    seen.add(r.data.sku);
    rows.push({ ...r.data, line });
  });
  return { rows, errors };
}

export async function previewCsv(ctx: Ctx, text: string): Promise<CsvPreview> {
  const { rows, errors } = parseCsv(text);
  const existing = new Set(
    (
      await withTenant(
        ctx,
        (tx) => tx.select({ sku: products.sku }).from(products),
        { write: false },
      )
    ).map((r) => r.sku),
  );
  for (const r of rows)
    if (existing.has(r.sku))
      errors.push({ row: r.line, message: `SKU ${r.sku} already exists` });
  return { count: rows.length, errors: errors.sort((a, b) => a.row - b.row) };
}

export async function commitCsv(ctx: Ctx, rows: CsvRowT[]) {
  const dek =
    ctx.role === "owner" && rows.some((r) => r.cost)
      ? await getDek(ctx)
      : undefined;
  return withTenant(ctx, async (tx) => {
    // one transaction: any failure rolls everything back
    const existing = new Set(
      (await tx.select({ sku: products.sku }).from(products)).map((r) => r.sku),
    );
    const dupes = rows.filter((r) => existing.has(r.sku));
    if (dupes.length)
      throw new UserError(
        "SKUs already exist: " +
          dupes
            .slice(0, 5)
            .map((r) => r.sku)
            .join(", "),
      );

    const catIds = new Map<string, string>();
    for (const name of new Set(
      rows.map((r) => r.category).filter(Boolean) as string[],
    )) {
      const [c] = await tx
        .insert(categories)
        .values({ orgId: ctx.orgId, name })
        .onConflictDoUpdate({
          target: [categories.orgId, categories.name],
          set: { name },
        })
        .returning();
      catIds.set(name, c.id);
    }
    for (const r of rows) {
      const [p] = await tx
        .insert(products)
        .values({
          orgId: ctx.orgId,
          sku: r.sku,
          name: r.name,
          categoryId: r.category ? catIds.get(r.category)! : null,
          currency: normalizeCurrency(r.currency),
          sellPriceCents: toCents(r.price),
          reorderLevel: r.reorder_level,
        })
        .returning();
      const cost = ctx.role === "owner" && r.cost ? toCents(r.cost) : undefined;
      if (r.stock > 0) {
        await insertMovement(
          tx,
          ctx,
          {
            productId: p.id,
            type: "purchase",
            qty: r.stock,
            note: "CSV import",
            unitCostCents: cost,
          },
          dek,
        );
      } else if (cost != null) {
        await insertCost(tx, ctx, dek!, p.id, cost, null);
      }
    }
    await audit(tx, ctx, "csv.import", "products", undefined, {
      rows: rows.length,
    });
    return rows.length;
  });
}

const safe = (v: unknown) => {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; // spreadsheet formula-injection guard
};
const cents = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));

export async function exportCsv(ctx: Ctx) {
  const list = await listProducts(ctx, { limit: 100000 });
  const cats = new Map((await listCategories(ctx)).map((c) => [c.id, c.name]));
  const rows = list.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.categoryId ? (cats.get(p.categoryId) ?? "") : "",
    currency: p.currency,
    price: cents(p.sellPriceCents),
    stock: p.stockOnHand,
    reorder_level: p.reorderLevel,
    ...(ctx.role === "owner"
      ? { cost: "costCents" in p ? cents(p.costCents) : "" }
      : {}),
  }));
  await withTenant(ctx, (tx) => audit(tx, ctx, "csv.export", "products"));
  return Papa.unparse(
    rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safe(v)])),
    ),
  );
}
