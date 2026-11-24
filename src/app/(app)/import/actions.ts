"use server";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/server/auth/ctx";
import { UserError } from "@/lib/errors";
import {
  commitCsv,
  parseCsv,
  previewCsv,
  type CsvPreview,
} from "@/server/services/csv";

const MAX = 1_000_000; // Server Actions accept 1 MB by default

export async function previewCsvAction(text: string): Promise<CsvPreview> {
  const ctx = await getCtx();
  try {
    if (text.length > MAX) throw new UserError("File too large (max 1 MB).");
    const p = await previewCsv(ctx, text);
    return { ...p, errors: p.errors.slice(0, 50) };
  } catch (e) {
    if (e instanceof UserError)
      return { count: 0, errors: [], error: e.message };
    throw e;
  }
}

export async function importCsvAction(
  text: string,
): Promise<{ count?: number; error?: string }> {
  const ctx = await getCtx();
  try {
    if (text.length > MAX) throw new UserError("File too large (max 1 MB).");
    const p = await previewCsv(ctx, text);
    if (p.errors.length) return { error: "Fix the errors first." };
    const n = await commitCsv(ctx, parseCsv(text).rows);
    revalidatePath("/products");
    return { count: n };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}
