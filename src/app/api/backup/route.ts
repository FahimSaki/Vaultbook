import { getCtxOrNull } from "@/server/auth/ctx";
import { isPortable } from "@/server/config";
import { backupStream } from "@/server/portable/backup";
import { hostBlocked } from "@/server/portable/host";

export async function GET(req: Request) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  if (!isPortable) return new Response("Not found", { status: 404 });
  if (!(await getCtxOrNull())) return new Response("Locked", { status: 401 });
  const day = new Date().toISOString().slice(0, 10);
  // vault.enc is sealed and blobs/ holds only ciphertext, so the tar needs no extra encryption
  return new Response(backupStream(), {
    headers: {
      "Content-Type": "application/x-tar",
      "Content-Disposition": `attachment; filename="vaultbook-backup-${day}.tar"`,
      "Cache-Control": "no-store",
    },
  });
}
