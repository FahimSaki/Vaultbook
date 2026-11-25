"use server";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/server/auth/ctx";
import {
  addCategory,
  deleteCategory,
  renameCategory,
} from "@/server/services/categories";
import { fail, text, type FormState } from "@/lib/form";

export async function addCategoryAction(form: FormData) {
  await addCategory(await getCtx(), text(form, "name"));
  revalidatePath("/categories");
}

export async function renameCategoryAction(
  id: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await getCtx();
  try {
    await renameCategory(ctx, id, text(form, "name"));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/categories");
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteCategoryAction(id: string) {
  await deleteCategory(await getCtx(), id);
  revalidatePath("/categories");
}
