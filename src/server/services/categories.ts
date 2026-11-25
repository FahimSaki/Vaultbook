import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { categories } from "@/server/db/schema";
import { UserError, pgCode } from "@/lib/errors";

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

export const renameCategory = (ctx: Ctx, id: string, name: string) =>
  withTenant(ctx, async (tx) => {
    const n = name.trim().slice(0, 100);
    if (!n) throw new UserError("Enter a name.");
    if (!z.uuid().safeParse(id).success)
      throw new UserError("Category not found.");
    try {
      await tx.update(categories).set({ name: n }).where(eq(categories.id, id));
    } catch (e) {
      if (pgCode(e) === "23505")
        throw new UserError("That category already exists.");
      throw e;
    }
  });

export const deleteCategory = (ctx: Ctx, id: string) =>
  withTenant(ctx, (tx) => tx.delete(categories).where(eq(categories.id, id)));
