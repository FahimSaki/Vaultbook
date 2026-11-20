"use server";
import { redirect } from "next/navigation";
import { UserError } from "@/lib/errors";
import {
  createVault,
  unlockVault,
  unlockWithRecovery,
  lockVault,
} from "@/server/portable/vault";
import { setSessionCookie } from "@/server/portable/session";

type State = { error?: string; recovery?: string } | null;
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function setupAction(_: State, form: FormData): Promise<State> {
  if (str(form, "password") !== str(form, "confirm"))
    return { error: "Passwords do not match." };
  try {
    const recovery = await createVault(
      str(form, "password"),
      str(form, "shop"),
    );
    await setSessionCookie();
    return { recovery }; // shown once, with an "I wrote it down" checkbox
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

export async function unlockAction(_: State, form: FormData): Promise<State> {
  try {
    await unlockVault(str(form, "password"));
    await setSessionCookie();
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  redirect("/products"); // redirect() throws on purpose, so keep it outside try/catch
}

export async function recoverAction(_: State, form: FormData): Promise<State> {
  if (str(form, "password") !== str(form, "confirm"))
    return { error: "Passwords do not match." };
  try {
    const recovery = await unlockWithRecovery(
      str(form, "code"),
      str(form, "password"),
    );
    await setSessionCookie();
    return { recovery };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

export async function lockAction() {
  await lockVault();
  redirect("/unlock");
}
