import { getCtx } from "@/server/auth/ctx";
import { readVaultForBackup } from "@/server/portable/vault";
import { hostBlocked } from "@/server/portable/host";

export async function GET(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  await getCtx(); // must be unlocked in this browser
  const file = await readVaultForBackup(); // already sealed, safe to hand over
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="vaultbook-backup-${day}.enc"`,
      "Cache-Control": "no-store",
    },
  });
}
