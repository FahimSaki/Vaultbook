import { getCtxOrNull } from "@/server/auth/ctx";
import { lockVault } from "@/server/portable/vault";
import { hostBlocked } from "@/server/portable/host";

export async function POST(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  const ctx = await getCtxOrNull();

  if (!ctx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await lockVault();
  return Response.json({ ok: true });
}
