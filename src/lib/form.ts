import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { Forbidden, Locked, UserError } from "@/lib/errors";

export type FormState = { error?: string; ok?: boolean } | null;

export const text = (f: FormData, k: string) => String(f.get(k) ?? "");
export const optText = (f: FormData, k: string) => text(f, k).trim() || null;
export const optNum = (f: FormData, k: string) => {
  const v = text(f, k).trim();
  return v === "" ? undefined : Number(v);
};

/** Turns expected errors into form messages; anything else is rethrown. */
export function fail(e: unknown): FormState {
  if (e instanceof Locked) redirect("/unlock");
  if (e instanceof ZodError)
    return { error: e.issues[0]?.message ?? "Invalid input." };
  if (e instanceof UserError) return { error: e.message };
  if (e instanceof Forbidden) return { error: "Only the owner can do that." };
  throw e;
}
