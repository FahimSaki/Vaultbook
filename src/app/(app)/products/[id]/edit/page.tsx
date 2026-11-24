import { notFound } from "next/navigation";
import { getCtx } from "@/server/auth/ctx";
import { listCategories } from "@/server/services/categories";
import { getProductDetail } from "@/server/services/products";
import { COMMON_CURRENCIES } from "@/lib/money";
import { ProductForm } from "@/components/ProductForm";
import { updateProductAction } from "../../actions";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getCtx();
  const { id } = await params;
  const d = await getProductDetail(ctx, id);
  if (!d) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit {d.product.name}</h1>
      <ProductForm
        action={updateProductAction.bind(null, id)}
        categories={await listCategories(ctx)}
        currencies={COMMON_CURRENCIES}
        showCost={false}
        product={d.product}
      />
    </div>
  );
}
