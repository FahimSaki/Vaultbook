import { getCtxOrNull } from "@/server/auth/ctx";
import { isPortable } from "@/server/config";
import { requireSession } from "@/server/portable/vault";
import { hostBlocked } from "@/server/portable/host";

export async function POST(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  if (!isPortable) return new Response("Not found", { status: 404 });
  if (!(await getCtxOrNull())) return new Response("Locked", { status: 401 });
  requireSession(); // refreshes the server's idle timer
  return Response.json({ ok: true });
}
