"use server";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/server/auth/ctx";
import { withTenant } from "@/server/db/tenant";
import { products } from "@/server/db/schema";
import { toCents } from "@/lib/money";

export async function addDemoProduct(form: FormData) {
  const ctx = await getCtx();
  await withTenant(ctx, (tx) =>
    tx.insert(products).values({
      orgId: ctx.orgId,
      sku: String(form.get("sku")).trim(),
      name: String(form.get("name")).trim(),
      sellPriceCents: toCents(String(form.get("price"))),
    }),
  );
  revalidatePath("/products");
}
