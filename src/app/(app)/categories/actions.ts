"use server";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/server/auth/ctx";
import { addCategory, deleteCategory } from "@/server/services/categories";
import { text } from "@/lib/form";

export async function addCategoryAction(form: FormData) {
  await addCategory(await getCtx(), text(form, "name"));
  revalidatePath("/categories");
}
export async function deleteCategoryAction(id: string) {
  await deleteCategory(await getCtx(), id);
  revalidatePath("/categories");
}
