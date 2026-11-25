import { eq } from "drizzle-orm";
import { Forbidden } from "@/lib/errors";
import { isPortable } from "@/server/config";
import { organizations } from "@/server/db/schema";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { requireSession } from "@/server/portable/vault";
import { unwrapDek } from "./keys";
import { masterKey } from "./master";

const cache = new Map<string, { dek: Buffer; exp: number }>();

export async function getDek(ctx: Ctx): Promise<Buffer> {
  if (isPortable) {
    const s = requireSession();
    if (s.orgId !== ctx.orgId) throw new Forbidden();
    return s.dek;
  }
  const hit = cache.get(ctx.orgId);
  if (hit && hit.exp > Date.now()) return hit.dek;
  const [org] = await withTenant(
    ctx,
    (tx) =>
      tx.select().from(organizations).where(eq(organizations.id, ctx.orgId)),
    { write: false },
  );
  if (!org) throw new Forbidden();
  const dek = unwrapDek(masterKey(), org.wrappedDek, org.id);
  cache.set(ctx.orgId, { dek, exp: Date.now() + 5 * 60_000 }); // short TTL, memory only
  return dek;
}
