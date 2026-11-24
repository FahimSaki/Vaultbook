import { getCtxOrNull } from "@/server/auth/ctx";
import { hostBlocked } from "@/server/portable/host";
import { exportCsv } from "@/server/services/csv";

export async function GET(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  const ctx = await getCtxOrNull();
  if (!ctx) return new Response("Locked", { status: 401 });
  const day = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + (await exportCsv(ctx)), {
    // BOM so Excel reads non-ASCII names
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
