import { hostBlocked } from "@/server/portable/host";
import { getSession } from "@/server/portable/vault";

const g = globalThis as unknown as { __vbBeat?: number };
g.__vbBeat ??= Date.now();

export async function GET(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  if (new URL(req.url).searchParams.has("ping")) g.__vbBeat = Date.now();
  return Response.json({
    ok: true,
    idleMs: Date.now() - g.__vbBeat!,
    saveError: getSession()?.saveError ?? null,
  });
}
