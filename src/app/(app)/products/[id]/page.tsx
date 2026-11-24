import Link from "next/link";
import { notFound } from "next/navigation";
import { getCtx } from "@/server/auth/ctx";
import { getProductDetail } from "@/server/services/products";
import { listImages } from "@/server/services/images";
import { formatMoney } from "@/lib/money";
import { isOwnerDTO } from "@/lib/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { MovementForm } from "@/components/MovementForm";
import { PriceChart } from "@/components/PriceChart";
import { ImageGallery } from "@/components/ImageGallery";
import { archiveProductAction } from "../actions";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getCtx();
  const { id } = await params;
  const d = await getProductDetail(ctx, id);
  if (!d) notFound();

  const images = await listImages(ctx, id);
  const { product: p, movements, points } = d;
  const owner = ctx.role === "owner";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{p.name}</h1>
          <p className="text-sm text-muted-foreground">{p.sku}</p>
          {p.description ? (
            <p className="mt-2 max-w-prose text-sm">{p.description}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/products/${id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit
          </Link>
          <form action={archiveProductAction.bind(null, id)}>
            <Button type="submit" variant="destructive">
              Archive
            </Button>
          </form>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Price</dt>
          <dd>{formatMoney(p.sellPriceCents, p.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">In stock</dt>
          <dd className={p.lowStock ? "font-medium text-destructive" : ""}>
            {p.stockOnHand}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reorder at</dt>
          <dd>{p.reorderLevel}</dd>
        </div>
        {owner && isOwnerDTO(p) ? (
          <div>
            <dt className="text-muted-foreground">Cost / margin</dt>
            <dd>
              {p.costCents != null ? formatMoney(p.costCents, p.currency) : "–"}
              {p.marginPercent != null ? ` · ${p.marginPercent}%` : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <section className="space-y-2">
        <h2 className="font-medium">Photos</h2>
        <ImageGallery productId={id} ids={images} />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Record stock</h2>
        <MovementForm productId={id} showCost={owner} />
      </section>

      {points.length > 1 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Price history</h2>
          <PriceChart points={points} />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-medium">Movements</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="py-1.5 text-muted-foreground">
                  {m.createdAt.toLocaleString("en-GB")}
                </td>
                <td>{m.type}</td>
                <td className={m.qty < 0 ? "text-destructive" : ""}>
                  {m.qty > 0 ? "+" + m.qty : m.qty}
                </td>
                <td className="text-muted-foreground">{m.note}</td>
              </tr>
            ))}
            {movements.length === 0 ? (
              <tr>
                <td className="py-2 text-muted-foreground">
                  No movements yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
