import { lockVault } from "@/server/portable/vault";
import { hostBlocked } from "@/server/portable/host";

export async function POST(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;

  const t = process.env.LAUNCHER_TOKEN;
  if (!t || req.headers.get("x-launcher-token") !== t)
    return new Response("Forbidden", { status: 403 });

  try {
    await lockVault(); // flush, seal, wipe keys
  } finally {
    setTimeout(() => process.exit(0), 200);
  }

  return Response.json({ ok: true });
}
