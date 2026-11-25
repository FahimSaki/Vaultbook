import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { makeTestDb, driver } from "./helpers/db";
import { __setDbForTests } from "@/server/db/client";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { organizations, memberships } from "@/server/db/schema";
import { pgCode } from "@/lib/errors";

describe.runIf(driver === "pg")("shop signup policies (as vb_app)", () => {
  let h: Awaited<ReturnType<typeof makeTestDb>>;
  beforeAll(async () => {
    h = await makeTestDb();
    __setDbForTests(h.db);
  });
  afterAll(async () => {
    __setDbForTests(undefined);
    await h.close();
  });

  it("a new user can create their own shop and owner membership", async () => {
    const orgId = randomUUID();
    const ctx: Ctx = { userId: "newbie", orgId, role: "owner" };
    await withTenant(ctx, async (tx) => {
      await tx
        .insert(organizations)
        .values({ id: orgId, name: "Mine", wrappedDek: Buffer.from([1]) });
      await tx
        .insert(memberships)
        .values({ userId: "newbie", orgId, role: "owner" });
    });
    const rows = await withTenant(
      ctx,
      (tx) => tx.select().from(organizations),
      {
        write: false,
      },
    );
    expect(rows).toHaveLength(1);
  });

  it("nobody can create a shop with a different id than their context", async () => {
    const ctx: Ctx = { userId: "evil", orgId: randomUUID(), role: "owner" };
    await expect(
      withTenant(ctx, (tx) =>
        tx
          .insert(organizations)
          .values({
            id: randomUUID(),
            name: "Other",
            wrappedDek: Buffer.from([1]),
          }),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });
});
