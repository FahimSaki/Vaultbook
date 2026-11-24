"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCtx } from "@/server/auth/ctx";
import {
  archiveProduct,
  createProduct,
  updateProduct,
} from "@/server/services/products";
import { recordMovement } from "@/server/services/stock";
import { MovementSchema } from "@/lib/schemas";
import { toCents } from "@/lib/money";
import { fail, optNum, optText, text, type FormState } from "@/lib/form";

const fields = (form: FormData) => ({
  sku: text(form, "sku"),
  name: text(form, "name"),
  categoryId: optText(form, "categoryId"),
  description: optText(form, "description"),
  sellPriceCents: toCents(text(form, "price")),
  currency: optText(form, "currency"),
  reorderLevel: optNum(form, "reorderLevel"),
});

export async function createProductAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await getCtx();
  let id: string;
  try {
    const cost = text(form, "cost").trim();
    const p = await createProduct(ctx, {
      ...fields(form),
      initialStock: optNum(form, "initialStock"),
      costCents: cost ? toCents(cost) : null,
    });
    id = p.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/products");
  redirect("/products/" + id);
}

export async function updateProductAction(
  id: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await getCtx();
  try {
    await updateProduct(ctx, id, fields(form));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/products");
  redirect("/products/" + id);
}

export async function archiveProductAction(id: string) {
  const ctx = await getCtx();
  await archiveProduct(ctx, id);
  revalidatePath("/products");
  redirect("/products");
}

export async function recordMovementAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await getCtx();
  const productId = text(form, "productId");
  try {
    const cost = text(form, "cost").trim();
    await recordMovement(
      ctx,
      MovementSchema.parse({
        productId,
        type: text(form, "type"),
        qty: Number(text(form, "qty")),
        note: optText(form, "note"),
        unitCostCents: cost ? toCents(cost) : null,
      }),
    );
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/products/" + productId);
  revalidatePath("/products");
  return { ok: true };
}
