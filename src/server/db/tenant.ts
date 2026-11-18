import { sql } from "drizzle-orm";
import { getDb, type Db } from "./client";
import { isPortable } from "../config";
import { markDirty } from "../portable/vault";

export type Ctx = { userId: string; orgId: string; role: "owner" | "staff" };

export async function withTenant<T>(
  ctx: Ctx,
  fn: (tx: Db) => Promise<T>,
  opts: { write?: boolean } = {},
): Promise<T> {
  const result = await getDb().transaction(async (tx) => {
    // 'true' = transaction-local, so pooled connections stay clean
    await tx.execute(sql`SELECT
      set_config('app.user_id', ${ctx.userId}, true),
      set_config('app.org_id', ${ctx.orgId}, true),
      set_config('app.role', ${ctx.role}, true)`);
    return fn(tx as unknown as Db);
  });
  if (isPortable && opts.write !== false) markDirty(); // pass { write: false } for reads
  return result;
}
