import { Forbidden } from "@/lib/errors";
import type { Ctx } from "@/server/db/tenant";
import { requireSession } from "@/server/portable/vault";

export async function getDek(ctx: Ctx): Promise<Buffer> {
  const s = requireSession();
  if (s.orgId !== ctx.orgId) throw new Forbidden();
  return s.dek;
}
