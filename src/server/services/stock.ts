import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { withTenant, type Ctx } from "@/server/db/tenant";
import {
  auditLog,
  buyListItems,
  costHistory,
  products,
  stockMovements,
} from "@/server/db/schema";
import { Forbidden, UserError, pgCode } from "@/lib/errors";
import type { MovementInput } from "@/lib/schemas";
import { getDek } from "@/server/crypto/dek";
import { encryptCost } from "@/server/crypto/keys";

export async function audit(
  tx: Db,
  ctx: Ctx,
  action: string,
  entity: string,
  entityId?: string,
  detail?: object,
) {
  await tx.insert(auditLog).values({
    orgId: ctx.orgId,
    actor: ctx.userId,
    action,
    entity,
    entityId: entityId ?? null,
    detail: detail ?? null,
  });
}

export async function insertCost(
  tx: Db,
  ctx: Ctx,
  dek: Buffer,
  productId: string,
  cents: number,
  movementId: number | null,
) {
  if (ctx.role !== "owner") throw new Forbidden();
  await tx.insert(costHistory).values({
    orgId: ctx.orgId,
    productId,
    movementId,
    costEnc: encryptCost(dek, ctx.orgId, productId, cents),
  });
}

export async function insertMovement(
  tx: Db,
  ctx: Ctx,
  input: MovementInput,
  dek?: Buffer,
) {
  const qty =
    input.type === "sale"
      ? -Math.abs(input.qty)
      : input.type === "purchase"
        ? Math.abs(input.qty)
        : input.qty;
  if (qty === 0) throw new UserError("Quantity cannot be zero.");
  try {
    const [m] = await tx
      .insert(stockMovements)
      .values({
        orgId: ctx.orgId,
        productId: input.productId,
        type: input.type,
        qty,
        note: input.note ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    if (input.unitCostCents != null) {
      await insertCost(
        tx,
        ctx,
        dek ?? (await getDek(ctx)),
        input.productId,
        input.unitCostCents,
        m.id,
      );
    }
    const [p] = await tx
      .select()
      .from(products)
      .where(eq(products.id, input.productId));
    if (!p || p.archivedAt) throw new UserError("Product not found.");
    if (p.stockOnHand <= p.reorderLevel) {
      await tx
        .insert(buyListItems)
        .values({
          orgId: ctx.orgId,
          productId: p.id,
          autoSuggested: true,
          qtyNeeded: Math.max(1, p.reorderLevel * 2 - p.stockOnHand),
        })
        .onConflictDoNothing(); // partial unique index: one open item per product
    }
    await audit(tx, ctx, "stock." + input.type, "product", p.id, { qty });
    return m;
  } catch (e) {
    const code = pgCode(e);
    if (code === "23514")
      throw new UserError("Not enough stock for this change.");
    if (code === "23503") throw new UserError("Product not found.");
    throw e;
  }
}

export async function recordMovement(ctx: Ctx, input: MovementInput) {
  // fetch keys before the transaction opens
  const dek = input.unitCostCents != null ? await getDek(ctx) : undefined;
  return withTenant(ctx, (tx) => insertMovement(tx, ctx, input, dek));
}
