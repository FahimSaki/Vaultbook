import { asc, eq } from "drizzle-orm";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { categories } from "@/server/db/schema";

export const listCategories = (ctx: Ctx) =>
  withTenant(
    ctx,
    (tx) =>
      tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name)),
    { write: false },
  );

export const addCategory = (ctx: Ctx, name: string) =>
  withTenant(ctx, async (tx) => {
    const n = name.trim().slice(0, 100);
    if (!n) return;
    await tx
      .insert(categories)
      .values({ orgId: ctx.orgId, name: n })
      .onConflictDoNothing();
  });

export const deleteCategory = (ctx: Ctx, id: string) =>
  withTenant(ctx, (tx) => tx.delete(categories).where(eq(categories.id, id)));
