import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import { migrate, portableFilter } from "@/server/db/migrate";
import { pgliteExec } from "@/server/db/pglite-exec";
import { config } from "@/server/config";
import { hostBlocked } from "@/server/portable/host";

export async function GET(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  const t = process.env.LAUNCHER_TOKEN;
  if (!t || req.headers.get("x-launcher-token") !== t)
    return new Response("Forbidden", { status: 403 });
  const pg = new PGlite();
  await pg.waitReady;
  await migrate(pgliteExec(pg), config.migrationsDir, portableFilter);
  const n = (
    await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM products")
  ).rows[0].n;
  await pg.close();
  const img = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#888888" },
  })
    .webp()
    .toBuffer();
  return Response.json({ ok: true, products: n, imageBytes: img.length });
}
