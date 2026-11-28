import { timingSafeEqual } from "node:crypto";
import { isPortable } from "@/server/config";
import { seedDemo } from "@/server/seed/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never open when the secret is missing
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Only the demo deployment sets DEMO=1.
export async function GET(req: Request) {
  if (isPortable || process.env.DEMO !== "1" || !authorized(req))
    return new Response("Forbidden", { status: 403 });
  const r = await seedDemo();
  return Response.json({ ok: true, ...r });
}
