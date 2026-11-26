import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { memberships } from "@/server/db/schema";
import type { Ctx } from "@/server/db/tenant";
import { getAuth } from "./auth";

export async function hostedSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

// Only app.user_id is set here: the member_read policy allows exactly this lookup.
async function membershipFor(userId: string) {
  const [m] = await getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    return tx
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .limit(1);
  });
  return m ?? null;
}

// API routes: null means 401, never redirect.
export async function hostedCtxOrNull(): Promise<Ctx | null> {
  const s = await hostedSession();
  if (!s) return null;
  const m = await membershipFor(s.user.id);
  return m ? { userId: s.user.id, orgId: m.orgId, role: m.role } : null;
}

// Pages: the role always comes from the database, never from the client.
export async function hostedCtx(): Promise<Ctx> {
  const s = await hostedSession();
  if (!s) redirect("/login");
  const m = await membershipFor(s.user.id);
  if (!m) redirect("/onboarding");
  return { userId: s.user.id, orgId: m.orgId, role: m.role };
}
