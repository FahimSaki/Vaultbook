"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { hostedCtxOrNull, hostedSession } from "@/server/auth/hosted";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { memberships, organizations } from "@/server/db/schema";
import { newDek, wrapDek } from "@/server/crypto/keys";
import { masterKey } from "@/server/crypto/master";
import { fail, text, type FormState } from "@/lib/form";

export async function createShopAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await hostedSession();
  if (!session) redirect("/login");
  if (await hostedCtxOrNull()) redirect("/products"); // one shop per user
  const name = text(form, "shop").trim();
  if (!name) return { error: "Enter a shop name." };

  const orgId = randomUUID();
  const ctx: Ctx = { userId: session.user.id, orgId, role: "owner" };
  try {
    await withTenant(ctx, async (tx) => {
      await tx.insert(organizations).values({
        id: orgId,
        name,
        wrappedDek: wrapDek(masterKey(), newDek(), orgId),
      });
      await tx
        .insert(memberships)
        .values({ userId: ctx.userId, orgId, role: "owner" });
    });
  } catch (e) {
    return fail(e);
  }
  redirect("/products");
}
