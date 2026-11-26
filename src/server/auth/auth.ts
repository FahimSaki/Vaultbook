import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/server/db/client";
import * as authSchema from "@/server/db/auth-schema";

function create() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema: authSchema }),
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [nextCookies()], // keep last
  });
}

type Auth = ReturnType<typeof create>;
const g = globalThis as unknown as { __vbAuth?: Auth };
export const getAuth = (): Auth => (g.__vbAuth ??= create());
