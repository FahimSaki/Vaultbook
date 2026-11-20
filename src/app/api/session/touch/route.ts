import { getCtx } from "@/server/auth/ctx";
import { requireSession } from "@/server/portable/vault";
import { hostBlocked } from "@/server/portable/host";

export async function POST(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  await getCtx();
  requireSession(); // refreshes the server's idle timer
  return Response.json({ ok: true });
}
