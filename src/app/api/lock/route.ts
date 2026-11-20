import { getCtx } from "@/server/auth/ctx";
import { lockVault } from "@/server/portable/vault";
import { hostBlocked } from "@/server/portable/host";

export async function POST(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  await getCtx();
  await lockVault();
  return Response.json({ ok: true });
}
