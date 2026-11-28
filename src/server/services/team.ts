import { and, eq } from "drizzle-orm";
import { withTenant, type Ctx } from "@/server/db/tenant";
import { memberships } from "@/server/db/schema";
import { user, session } from "@/server/db/auth-schema";
import { Forbidden, UserError } from "@/lib/errors";
import { getAuth } from "@/server/auth/auth";

const ownerOnly = (ctx: Ctx) => {
  if (ctx.role !== "owner") throw new Forbidden();
};

// The public demo must keep its two accounts intact until the nightly reset.
const notInDemo = () => {
  if (process.env.DEMO === "1")
    throw new UserError("Not available in the demo.");
};

export async function listTeam(ctx: Ctx) {
  ownerOnly(ctx);
  return withTenant(
    ctx,
    (tx) =>
      tx
        .select({
          userId: memberships.userId,
          role: memberships.role,
          name: user.name,
          email: user.email,
        })
        .from(memberships)
        .innerJoin(user, eq(user.id, memberships.userId)),
    { write: false },
  );
}

export async function addStaff(
  ctx: Ctx,
  i: { name: string; email: string; password: string },
) {
  ownerOnly(ctx);
  notInDemo();
  const email = i.email.trim().toLowerCase();
  if (!email || !i.name.trim())
    throw new UserError("Name and email are required.");
  if (i.password.length < 12)
    throw new UserError("Use at least 12 characters.");
  const ac = await getAuth().$context;
  if (await ac.internalAdapter.findUserByEmail(email))
    throw new UserError("That email already has an account.");
  const u = await ac.internalAdapter.createUser(
    {
      email,
      name: i.name.trim(),
      emailVerified: true,
    },
    { method: "email-password" },
  );
  await ac.internalAdapter.linkAccount({
    userId: u.id,
    providerId: "credential",
    accountId: u.id,
    password: await ac.password.hash(i.password),
  });
  await withTenant(ctx, (tx) =>
    tx
      .insert(memberships)
      .values({ userId: u.id, orgId: ctx.orgId, role: "staff" }),
  );
}

export async function removeStaff(ctx: Ctx, userId: string) {
  ownerOnly(ctx);
  notInDemo();
  // RLS only lets the owner delete rows where role = 'staff'
  const gone = await withTenant(ctx, (tx) =>
    tx
      .delete(memberships)
      .where(
        and(eq(memberships.userId, userId), eq(memberships.orgId, ctx.orgId)),
      )
      .returning(),
  );
  if (gone.length)
    await withTenant(ctx, (tx) =>
      tx.delete(session).where(eq(session.userId, userId)),
    );
}
