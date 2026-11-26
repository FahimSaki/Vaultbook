"use server";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/server/auth/ctx";
import { addStaff, removeStaff } from "@/server/services/team";
import { fail, text, type FormState } from "@/lib/form";

export async function addStaffAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await getCtx();
  try {
    await addStaff(ctx, {
      name: text(form, "name"),
      email: text(form, "email"),
      password: text(form, "password"),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/team");
  return { ok: true };
}

export async function removeStaffAction(userId: string) {
  await removeStaff(await getCtx(), userId);
  revalidatePath("/team");
}
