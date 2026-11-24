import { getCtxOrNull } from "@/server/auth/ctx";
import { hostBlocked } from "@/server/portable/host";
import { getDek } from "@/server/crypto/dek";
import { getStore } from "@/server/storage";
import { deleteImageRow, findImage } from "@/server/services/images";
import { Locked } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  const ctx = await getCtxOrNull();
  if (!ctx) return new Response("Locked", { status: 401 });
  try {
    const { id } = await params;
    const row = await findImage(ctx, id); // another shop's id returns nothing
    if (!row) return new Response("Not found", { status: 404 });
    const key =
      new URL(req.url).searchParams.get("size") === "thumb"
        ? row.thumbKey
        : row.storageKey;
    const buf = await getStore(await getDek(ctx)).get(key);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store", // do not leave photos in the host PC's browser cache
      },
    });
  } catch (e) {
    if (e instanceof Locked) return new Response("Locked", { status: 401 });
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT")
      return new Response("Not found", { status: 404 });
    throw e;
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  const ctx = await getCtxOrNull();
  if (!ctx) return new Response("Locked", { status: 401 });
  try {
    const row = await deleteImageRow(ctx, (await params).id);
    if (!row) return new Response("Not found", { status: 404 });
    const store = getStore(await getDek(ctx));
    await store.delete(row.storageKey).catch(() => {});
    await store.delete(row.thumbKey).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Locked) return new Response("Locked", { status: 401 });
    throw e;
  }
}
