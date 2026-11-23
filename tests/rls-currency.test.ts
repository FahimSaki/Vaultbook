import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, driver } from "./helpers/db";
import { __setDbForTests } from "@/server/db/client";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { products } from "@/server/db/schema";
import { pgCode } from "@/lib/errors";

describe.runIf(driver === "pg")("currency is owner-only (as vb_app)", () => {
  let h: Awaited<ReturnType<typeof makeTestDb>>;
  let owner: Ctx, staff: Ctx;
  let productId: string;

  beforeAll(async () => {
    h = await makeTestDb();
    __setDbForTests(h.db);
    const org = (
      await h.admin.query<{ id: string }>(
        "INSERT INTO organizations (name, wrapped_dek) VALUES ('A', $1) RETURNING id",
        [Buffer.from([1])],
      )
    )[0].id;
    owner = { userId: "o", orgId: org, role: "owner" };
    staff = { userId: "s", orgId: org, role: "staff" };
    [{ id: productId }] = await withTenant(owner, (tx) =>
      tx
        .insert(products)
        .values({ orgId: org, sku: "C1", name: "C1", sellPriceCents: 1000 })
        .returning({ id: products.id }),
    );
  });
  afterAll(async () => {
    __setDbForTests(undefined);
    await h.close();
  });

  it("staff cannot change a product's currency", async () => {
    await expect(
      withTenant(staff, (tx) =>
        tx
          .update(products)
          .set({ currency: "USD" })
          .where(eq(products.id, productId)),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });

  it("owner can", async () => {
    await withTenant(owner, (tx) =>
      tx
        .update(products)
        .set({ currency: "USD" })
        .where(eq(products.id, productId)),
    );
    const [p] = await withTenant(owner, (tx) => tx.select().from(products), {
      write: false,
    });
    expect(p.currency).toBe("USD");
  });
});
