import { getCtxOrNull } from "@/server/auth/ctx";
import { isPortable } from "@/server/config";
import { lockVault } from "@/server/portable/vault";
import { hostBlocked } from "@/server/portable/host";

// Used by the idle countdown, so it always wipes the session (force).
export async function POST(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  if (!isPortable) return new Response("Not found", { status: 404 });
  if (!(await getCtxOrNull())) return new Response("Locked", { status: 401 });
  await lockVault({ force: true }).catch((e) =>
    console.error("lock failed to save:", (e as Error).message),
  );
  return Response.json({ ok: true });
}
