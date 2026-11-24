import Link from "next/link";
import { getCtx } from "@/server/auth/ctx";
import { listProducts } from "@/server/services/products";
import { formatMoney } from "@/lib/money";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string }>;
}) {
  const ctx = await getCtx();
  const { q, low } = await searchParams;
  const rows = await listProducts(ctx, { q, lowStock: low === "1" });
  const owner = ctx.role === "owner";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form className="flex items-center gap-2 text-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or SKU"
            className="rounded-lg border border-input bg-background px-3 py-1.5"
          />
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
              <td colSpan={4} className="py-3 text-muted-foreground">
                No products.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
