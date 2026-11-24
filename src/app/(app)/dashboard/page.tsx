import Link from "next/link";
import { getCtx } from "@/server/auth/ctx";
import { dashboard } from "@/server/services/dashboard";
import { formatMoney } from "@/lib/money";

const card = "rounded-xl border p-4";

export default async function DashboardPage() {
  const ctx = await getCtx();
  const d = await dashboard(ctx);
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-sm text-muted-foreground">Products</p>
          <p className="text-2xl font-semibold">{d.productCount}</p>
        </div>
        <Link href="/products?low=1" className={card}>
          <p className="text-sm text-muted-foreground">Low stock</p>
          <p className="text-2xl font-semibold">{d.lowStock}</p>
        </Link>
        <div className={card}>
          <p className="text-sm text-muted-foreground">
            Stock value at selling price
          </p>
          {d.retail.map((r) => (
            <p key={r.currency} className="font-semibold">
              {formatMoney(r.cents, r.currency)}
            </p>
          ))}
          {d.retail.length === 0 ? <p>–</p> : null}
        </div>
        {d.costValue ? (
          <div className={card}>
            <p className="text-sm text-muted-foreground">
              Stock value at cost (owner)
            </p>
            {d.costValue.map((r) => (
              <p key={r.currency} className="font-semibold">
                {formatMoney(r.cents, r.currency)}
              </p>
            ))}
            {d.costValue.length === 0 ? <p>–</p> : null}
          </div>
        ) : null}
      </div>
      <section className="space-y-2">
        <h2 className="font-medium">Top sellers, last 30 days</h2>
        <ul className="divide-y text-sm">
          {d.movers.map((m) => (
            <li key={m.id} className="flex justify-between py-2">
              <Link className="underline" href={"/products/" + m.id}>
                {m.name}
              </Link>
              <span>{m.sold} sold</span>
            </li>
          ))}
          {d.movers.length === 0 ? (
            <li className="py-2 text-muted-foreground">No sales yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
