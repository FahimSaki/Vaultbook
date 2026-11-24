import { getCtx } from "@/server/auth/ctx";
import { listCategories } from "@/server/services/categories";
import { COMMON_CURRENCIES } from "@/lib/money";
import { ProductForm } from "@/components/ProductForm";
import { createProductAction } from "../actions";

export default async function NewProductPage() {
  const ctx = await getCtx();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New product</h1>
      <ProductForm
        action={createProductAction}
        categories={await listCategories(ctx)}
        currencies={COMMON_CURRENCIES}
        showCost={ctx.role === "owner"}
      />
    </div>
  );
}
