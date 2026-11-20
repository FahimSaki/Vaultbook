import { getCtx } from "@/server/auth/ctx";
import { withTenant } from "@/server/db/tenant";
import { products } from "@/server/db/schema";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { addDemoProduct } from "./actions";

export default async function ProductsPage() {
  const ctx = await getCtx();
  const rows = await withTenant(ctx, (tx) => tx.select().from(products), {
    write: false,
  });
  return (
    <div className="space-y-6">
      <form action={addDemoProduct} className="flex gap-2" autoComplete="off">
        <input
          name="sku"
          placeholder="SKU"
          required
          className="rounded-lg border px-2 py-1 text-sm"
        />
        <input
          name="name"
          placeholder="Name"
          required
          className="rounded-lg border px-2 py-1 text-sm"
        />
        <input
          name="price"
          placeholder="Price"
          inputMode="decimal"
          required
          className="w-24 rounded-lg border px-2 py-1 text-sm"
        />
        <Button type="submit">Add</Button>
      </form>
      <ul className="divide-y">
        {rows.map((p) => (
          <li key={p.id} className="flex justify-between py-2 text-sm">
            <span>
              {p.sku} · {p.name}
            </span>
            <span>{formatMoney(p.sellPriceCents)}</span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="py-2 text-sm text-muted-foreground">
            No products yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
