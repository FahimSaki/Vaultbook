import Link from "next/link";
import { getCtx } from "@/server/auth/ctx";
import { listBuyList, type BuyStatus } from "@/server/services/buylist";
import { listProducts } from "@/server/services/products";
import { Button } from "@/components/ui/button";
import { AddBuyItemForm, ReceiveForm } from "@/components/BuyListForms";
import { receiveBuyItemAction, setStatusAction } from "./actions";

const TABS = ["open", "ordered", "received"] as const;

export default async function BuyListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getCtx();
  const { status } = await searchParams;
  const current = (TABS as readonly string[]).includes(status ?? "")
    ? (status as BuyStatus)
    : "open";
  const items = await listBuyList(ctx, current);
  const prods = await listProducts(ctx, { limit: 500 });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Buy list</h1>
      <AddBuyItemForm
        products={prods.map((p) => ({
          id: p.id,
          label: `${p.sku} · ${p.name}`,
        }))}
      />
      <div className="flex gap-4 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={"/buylist?status=" + t}
            className={
              t === current
                ? "font-semibold underline"
                : "text-muted-foreground"
            }
          >
            {t[0].toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>
      <ul className="divide-y">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <span>
              {i.productId ? `${i.sku} · ${i.name}` : i.freeText} × {i.qty}
              {i.auto ? (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                  auto
                </span>
              ) : null}
            </span>
            {current !== "received" ? (
              <div className="flex flex-wrap items-center gap-2">
                {current === "open" ? (
                  <form action={setStatusAction.bind(null, i.id, "ordered")}>
                    <Button type="submit" size="sm" variant="outline">
                      Mark ordered
                    </Button>
                  </form>
                ) : null}
                <form action={setStatusAction.bind(null, i.id, "dismissed")}>
                  <Button type="submit" size="sm" variant="ghost">
                    Dismiss
                  </Button>
                </form>
                {i.productId ? (
                  <ReceiveForm
                    action={receiveBuyItemAction.bind(null, i.id)}
                    qty={i.qty}
                    showCost={ctx.role === "owner"}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">Nothing here.</li>
        ) : null}
      </ul>
    </div>
  );
}
