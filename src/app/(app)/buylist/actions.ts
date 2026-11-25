"use server";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/server/auth/ctx";
import {
  addBuyItem,
  receiveBuyItem,
  setBuyStatus,
} from "@/server/services/buylist";
import { toCents } from "@/lib/money";
import { fail, optText, text, type FormState } from "@/lib/form";

export async function addBuyItemAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await getCtx();
  try {
    await addBuyItem(ctx, {
      productId: optText(form, "productId"),
      freeText: optText(form, "freeText"),
      qty: Number(text(form, "qty") || 1),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/buylist");
  return { ok: true };
}

export async function receiveBuyItemAction(
  id: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await getCtx();
  const qty = Number(text(form, "qty"));
  if (!Number.isInteger(qty) || qty < 1)
    return { error: "Quantity must be a whole number, at least 1." };
  try {
    const cost = text(form, "cost").trim();
    await receiveBuyItem(ctx, id, qty, cost ? toCents(cost) : null);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/buylist");
  revalidatePath("/products");
  return { ok: true };
}

export async function setStatusAction(
  id: string,
  status: "ordered" | "dismissed",
) {
  await setBuyStatus(await getCtx(), id, status);
  revalidatePath("/buylist");
}
