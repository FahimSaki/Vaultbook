import { Locked } from "@/lib/errors";
import type { Db } from "../db/client";

export type Session = { db: Db; orgId: string; dek: Buffer };

const g = globalThis as unknown as { __vb?: Session | null };

export const getSession = () => g.__vb ?? null;

export function requireSession(): Session {
  if (!g.__vb) throw new Locked("Vault is locked");
  return g.__vb;
}

export function markDirty() {} // real debounced save comes in Step 6

export async function lockVault() {
  g.__vb = null;
}
