"use server";
import { UserError } from "@/lib/errors";
import { getCtx } from "@/server/auth/ctx";
import { changePassword } from "@/server/portable/vault";

type State = { error?: string; recovery?: string } | null;
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function changePasswordAction(
  _: State,
  form: FormData,
): Promise<State> {
  await getCtx(); // redirects to /unlock if the vault is locked
  if (str(form, "next") !== str(form, "confirm"))
    return { error: "New passwords do not match." };
  try {
    // rekey() also issues a NEW recovery code; the old one stops working
    return {
      recovery: await changePassword(str(form, "current"), str(form, "next")),
    };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}
