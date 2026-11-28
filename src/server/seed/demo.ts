import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { getAuth } from "@/server/auth/auth";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { memberships, organizations } from "@/server/db/schema";
import { newDek, wrapDek } from "@/server/crypto/keys";
import { masterKey } from "@/server/crypto/master";
import { getStore } from "@/server/storage";
import { DEMO_ACCOUNTS } from "./demo-accounts";
import { seedShop } from "./shop";

/**
 * Wipes every shop and user. Needs the OWNER connection (SEED_DATABASE_URL): vb_app cannot
 * delete from the append-only tables, and must not be able to. TRUNCATE does not fire the
 * row-level append-only triggers, and CASCADE follows every foreign key from organizations and "user".
 */
export async function resetDemo() {
  const url = process.env.SEED_DATABASE_URL;
  if (!url) throw new Error("SEED_DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    // delete old photo objects first, or they pile up in the bucket every night
    const { rows } = await pool.query<{
      storage_key: string;
      thumb_key: string;
    }>("SELECT storage_key, thumb_key FROM product_images");
    const store = getStore(Buffer.alloc(32)); // deleting needs no real key
    for (const r of rows) {
      await store.delete(r.storage_key).catch(() => {});
      await store.delete(r.thumb_key).catch(() => {});
    }
    await pool.query(
      'TRUNCATE organizations, "user", verification RESTART IDENTITY CASCADE',
    );
  } finally {
    await pool.end();
  }
}

export async function seedDemo() {
  await resetDemo();

  const ac = await getAuth().$context;
  const ids = {} as Record<"owner" | "staff", string>;
  for (const key of ["owner", "staff"] as const) {
    const a = DEMO_ACCOUNTS[key];
    const u = await ac.internalAdapter.createUser(
      { email: a.email, name: a.name, emailVerified: true },
      { method: "email-password" },
    );
    await ac.internalAdapter.linkAccount({
      userId: u.id,
      providerId: "credential",
      accountId: u.id,
      password: await ac.password.hash(a.password),
    });
    ids[key] = u.id;
  }

  const orgId = randomUUID();
  const owner: Ctx = { userId: ids.owner, orgId, role: "owner" };
  await withTenant(owner, async (tx) => {
    await tx.insert(organizations).values({
      id: orgId,
      name: "Demo Shop",
      wrappedDek: wrapDek(masterKey(), newDek(), orgId),
    });
    await tx
      .insert(memberships)
      .values({ userId: ids.owner, orgId, role: "owner" });
    await tx
      .insert(memberships)
      .values({ userId: ids.staff, orgId, role: "staff" });
  });

  const products = await seedShop(owner, {
    photos: !!process.env.S3_BUCKET,
  });
  return { products };
}
