"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { FormState } from "@/lib/form";
import { createShopAction } from "@/app/(hosted)/onboarding/actions";

const input =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

function useAuthForm(
  call: (f: FormData) => Promise<{ error?: { message?: string } | null }>,
  next: string,
  fallback: string,
) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await call(new FormData(e.currentTarget));
    setBusy(false);
    if (res.error) return setError(fallback);
    router.replace(next);
    router.refresh();
  }
  return { error, busy, onSubmit };
}

export function LoginForm({ showSignup }: { showSignup: boolean }) {
  const f = useAuthForm(
    (d) =>
      authClient.signIn.email({
        email: String(d.get("email")),
        password: String(d.get("password")),
      }),
    "/products",
    "Wrong email or password.",
  );
  return (
    <form onSubmit={f.onSubmit} className="space-y-3">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <input
        className={input}
        name="email"
        type="email"
        placeholder="Email"
        required
      />
      <input
        className={input}
        name="password"
        type="password"
        placeholder="Password"
        required
      />
      {f.error ? <p className="text-sm text-destructive">{f.error}</p> : null}
      <Button type="submit" disabled={f.busy}>
        {f.busy ? "Signing in…" : "Sign in"}
      </Button>
      {showSignup ? (
        <p className="text-sm">
          <Link className="underline" href="/signup">
            Create a shop account
          </Link>
        </p>
      ) : null}
    </form>
  );
}

export function SignupForm() {
  const f = useAuthForm(
    (d) =>
      authClient.signUp.email({
        name: String(d.get("name")),
        email: String(d.get("email")),
        password: String(d.get("password")),
      }),
    "/onboarding",
    "Could not create the account. Use a new email and a password of 12+ characters.",
  );
  return (
    <form onSubmit={f.onSubmit} className="space-y-3">
      <h1 className="text-xl font-semibold">Create account</h1>
      <input className={input} name="name" placeholder="Your name" required />
      <input
        className={input}
        name="email"
        type="email"
        placeholder="Email"
        required
      />
      <input
        className={input}
        name="password"
        type="password"
        placeholder="Password (12+ characters)"
        required
        minLength={12}
        autoComplete="new-password"
      />
      {f.error ? <p className="text-sm text-destructive">{f.error}</p> : null}
      <Button type="submit" disabled={f.busy}>
        {f.busy ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}

export function OnboardingForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(
    createShopAction,
    null,
  );
  return (
    <form action={action} className="space-y-3" autoComplete="off">
      <h1 className="text-xl font-semibold">Name your shop</h1>
      <input className={input} name="shop" placeholder="Shop name" required />
      {s?.error ? <p className="text-sm text-destructive">{s.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create shop"}
      </Button>
    </form>
  );
}
