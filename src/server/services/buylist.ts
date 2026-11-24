import { desc, eq } from "drizzle-orm";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { buyListItems, products } from "@/server/db/schema";
import { UserError, pgCode } from "@/lib/errors";
import { getDek } from "@/server/crypto/dek";
import { audit, insertMovement } from "./stock";

export type BuyStatus = "open" | "ordered" | "received" | "dismissed";

export const listBuyList = (ctx: Ctx, status: BuyStatus = "open") =>
  withTenant(
    ctx,
    (tx) =>
      tx
        .select({
          id: buyListItems.id,
          productId: buyListItems.productId,
          name: products.name,
          sku: products.sku,
          freeText: buyListItems.freeText,
          qty: buyListItems.qtyNeeded,
          auto: buyListItems.autoSuggested,
        })
        .from(buyListItems)
        .leftJoin(products, eq(products.id, buyListItems.productId))
        .where(eq(buyListItems.status, status))
        .orderBy(desc(buyListItems.createdAt)),
    { write: false },
  );

export const addBuyItem = (
  ctx: Ctx,
  i: { productId?: string | null; freeText?: string | null; qty: number },
) =>
  withTenant(ctx, async (tx) => {
    const freeText = i.freeText?.trim() || null;
    if (!i.productId && !freeText)
      throw new UserError("Pick a product or type what you need.");
    if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > 1_000_000)
      throw new UserError("Quantity must be at least 1.");
    try {
      await tx.insert(buyListItems).values({
        orgId: ctx.orgId,
        productId: i.productId || null,
        freeText: i.productId ? null : freeText,
        qtyNeeded: i.qty,
      });
    } catch (e) {
      if (pgCode(e) === "23505")
        throw new UserError("That product is already on the open list.");
      if (pgCode(e) === "23503") throw new UserError("Product not found.");
      throw e;
    }
    await audit(tx, ctx, "buylist.add", "buy_list_item");
  });

export const setBuyStatus = (
  ctx: Ctx,
  id: string,
  status: "ordered" | "dismissed",
) =>
  withTenant(ctx, async (tx) => {
    await tx
      .update(buyListItems)
      .set({ status })
      .where(eq(buyListItems.id, id));
    await audit(tx, ctx, "buylist." + status, "buy_list_item", id);
  });

export async function receiveBuyItem(
  ctx: Ctx,
  id: string,
  qty: number,
  unitCostCents?: number | null,
) {
  const dek = unitCostCents != null ? await getDek(ctx) : undefined;
  return withTenant(ctx, async (tx) => {
    const [item] = await tx
      .select()
      .from(buyListItems)
      .where(eq(buyListItems.id, id));
    if (!item?.productId)
      throw new UserError("Only product items can be received.");
    if (item.status === "received" || item.status === "dismissed")
      throw new UserError("This item is already closed.");
    // close first, so a fresh suggestion can appear if stock is still low afterwards
    await tx
      .update(buyListItems)
      .set({ status: "received" })
      .where(eq(buyListItems.id, id));
    await insertMovement(
      tx,
      ctx,
      {
        productId: item.productId,
        type: "purchase",
        qty,
        unitCostCents,
        note: "Received from buy list",
      },
      dek,
    );
  });
}
