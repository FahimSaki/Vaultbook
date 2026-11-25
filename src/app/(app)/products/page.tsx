import Link from "next/link";
import { z } from "zod";
import { getCtx } from "@/server/auth/ctx";
import { listProducts } from "@/server/services/products";
import { listCategories } from "@/server/services/categories";
import { formatMoney } from "@/lib/money";
import { Button, buttonVariants } from "@/components/ui/button";

const field =
  "rounded-lg border border-input bg-background px-3 py-1.5 text-sm";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; c?: string }>;
}) {
  const ctx = await getCtx();
  const { q, low, c } = await searchParams;
  const categoryId = c && z.uuid().safeParse(c).success ? c : undefined;
  const [rows, cats] = await Promise.all([
    listProducts(ctx, { q, lowStock: low === "1", categoryId }),
    listCategories(ctx),
  ]);
  const catName = new Map(cats.map((x) => [x.id, x.name]));
  const owner = ctx.role === "owner";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or SKU"
            className={field}
          />
          <select name="c" defaultValue={categoryId ?? ""} className={field}>
            <option value="">All categories</option>
            {cats.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={low === "1"}
            />{" "}
            Low stock
          </label>
          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>
        </form>
        <Link href="/products/new" className={buttonVariants()}>
          Add product
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Product</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Price</th>
            {owner ? <th>Margin</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="py-2">
                <Link className="underline" href={"/products/" + p.id}>
                  {p.sku} · {p.name}
                </Link>
              </td>
              <td className="text-muted-foreground">
                {p.categoryId ? (catName.get(p.categoryId) ?? "") : ""}
              </td>
              <td className={p.lowStock ? "font-medium text-destructive" : ""}>
                {p.stockOnHand}
              </td>
              <td>{formatMoney(p.sellPriceCents, p.currency)}</td>
              {owner ? (
                <td>
                  {"marginPercent" in p && p.marginPercent != null
                    ? p.marginPercent + "%"
                    : "–"}
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={owner ? 5 : 4}
                className="py-3 text-muted-foreground"
              >
                No products.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
