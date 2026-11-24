import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, vaultExists } from "./vault";

const g = globalThis as unknown as { __vbSecret?: Buffer };
const secret = (g.__vbSecret ??= randomBytes(32)); // new secret on every app start
const COOKIE = "vb_session";
const TTL = 12 * 60 * 60 * 1000; // the server's 15-minute idle lock is the real timeout

const sign = (p: string) =>
  createHmac("sha256", secret).update(p).digest("base64url");

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function setSessionCookie() {
  const s = getSession();
  if (!s) return;

  const payload = s.id + "." + (Date.now() + TTL);

  (await cookies()).set(COOKIE, payload + "." + sign(payload), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
}

export async function portableCtxOrNull() {
  const s = getSession();
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [id, exp, sig] = raw.split(".");

  const valid =
    s &&
    sig &&
    id === s.id &&
    Number(exp) > Date.now() &&
    same(sig, sign(id + "." + exp));

  return valid
    ? { userId: "owner", orgId: s.orgId, role: "owner" as const }
    : null;
}

export async function portableCtx() {
  const c = await portableCtxOrNull();

  if (!c) redirect((await vaultExists()) ? "/unlock" : "/setup");

  return c;
}
