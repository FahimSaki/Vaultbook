import { z } from "zod";
import { getCtxOrNull } from "@/server/auth/ctx";
import { hostBlocked } from "@/server/portable/host";
import { getDek } from "@/server/crypto/dek";
import { getStore } from "@/server/storage";
import { MAX_IMAGE_BYTES, processImage } from "@/server/storage/process";
import { createImageRow, deleteImageRow } from "@/server/services/images";
import { Locked, UserError } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = hostBlocked(req);
  if (blocked) return blocked;
  const ctx = await getCtxOrNull();
  if (!ctx) return Response.json({ error: "Locked" }, { status: 401 });
  const { id: productId } = await params;
  if (!z.uuid().safeParse(productId).success)
    return Response.json({ error: "Not found" }, { status: 404 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size > MAX_IMAGE_BYTES)
    return Response.json({ error: "Max 5 MB" }, { status: 400 });
  try {
    const { full, thumb } = await processImage(
      Buffer.from(await file.arrayBuffer()),
    );
    const row = await createImageRow(ctx, productId);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    const store = getStore(await getDek(ctx));
    try {
      await store.put(row.storageKey, full, "image/webp");
      await store.put(row.thumbKey, thumb, "image/webp");
    } catch (e) {
      await deleteImageRow(ctx, row.id);
      await store.delete(row.storageKey).catch(() => {});
      await store.delete(row.thumbKey).catch(() => {});
      throw e;
    }
    return Response.json({ id: row.id });
  } catch (e) {
    if (e instanceof Locked)
      return Response.json({ error: "Locked" }, { status: 401 });
    if (e instanceof UserError)
      return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
