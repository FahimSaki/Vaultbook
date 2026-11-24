import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { productImages, products } from "@/server/db/schema";
import { UserError } from "@/lib/errors";

const uuid = z.uuid();

export async function createImageRow(ctx: Ctx, productId: string) {
  return withTenant(ctx, async (tx) => {
    const [p] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (!p) return null;
    const existing = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    if (existing.length >= 10)
      throw new UserError("Max 10 photos per product.");
    const id = randomUUID();
    const base = `org/${ctx.orgId}/${id}`;
    const [row] = await tx
      .insert(productImages)
      .values({
        id,
        orgId: ctx.orgId,
        productId,
        storageKey: base + "-full.webp",
        thumbKey: base + "-thumb.webp",
        position: existing.length,
      })
      .returning();
    return row;
  });
}

export const listImages = (ctx: Ctx, productId: string) =>
  withTenant(
    ctx,
    async (tx) =>
      (
        await tx
          .select({ id: productImages.id })
          .from(productImages)
          .where(eq(productImages.productId, productId))
          .orderBy(asc(productImages.position))
      ).map((r) => r.id),
    { write: false },
  );

export async function findImage(ctx: Ctx, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [row] = await withTenant(
    ctx,
    (tx) => tx.select().from(productImages).where(eq(productImages.id, id)),
    { write: false },
  );
  return row ?? null;
}

export async function deleteImageRow(ctx: Ctx, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [row] = await withTenant(ctx, (tx) =>
    tx.delete(productImages).where(eq(productImages.id, id)).returning(),
  );
  return row ?? null;
}
