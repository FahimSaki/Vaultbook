"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setupAction, unlockAction, recoverAction } from "@/app/(auth)/actions";

const input =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

function RecoveryCode({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        Write this recovery code on paper
      </h1>
      <p className="text-sm text-muted-foreground">
        It is shown once. If you forget your password and lose this code, your
        data cannot be recovered.
      </p>
      <code className="block break-all rounded-lg bg-muted p-3 text-sm">
        {code}
      </code>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ok}
          onChange={(e) => setOk(e.target.checked)}
        />
        I wrote it down
      </label>
      {ok ? (
        <Link className="underline" href="/products">
          Continue
        </Link>
      ) : null}
    </div>
  );
}

export function SetupForm() {
  const [s, action, pending] = useActionState(setupAction, null);
  if (s?.recovery) return <RecoveryCode code={s.recovery} />;
  return (
    <form action={action} className="space-y-3" autoComplete="off">
      <h1 className="text-xl font-semibold">Create your vault</h1>
      <input className={input} name="shop" placeholder="Shop name" required />
      <input
        className={input}
        name="password"
        type="password"
        placeholder="Password (12+ characters)"
        required
        minLength={12}
        autoComplete="new-password"
      />
      <input
        className={input}
        name="confirm"
        type="password"
        placeholder="Repeat password"
        required
        autoComplete="new-password"
      />
      {s?.error ? <p className="text-sm text-destructive">{s.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create vault"}
      </Button>
    </form>
  );
}

export function UnlockForm() {
  const [s, action, pending] = useActionState(unlockAction, null);
  return (
    <form action={action} className="space-y-3" autoComplete="off">
      <h1 className="text-xl font-semibold">Unlock Vaultbook</h1>
      <input
        className={input}
        name="password"
        type="password"
        placeholder="Password"
        required
        autoFocus
        autoComplete="off"
      />
      {s?.error ? <p className="text-sm text-destructive">{s.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Unlocking…" : "Unlock"}
      </Button>
      <p className="text-sm">
        <Link className="underline" href="/recover">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}

export function RecoverForm() {
  const [s, action, pending] = useActionState(recoverAction, null);
  if (s?.recovery) return <RecoveryCode code={s.recovery} />;
  return (
    <form action={action} className="space-y-3" autoComplete="off">
      <h1 className="text-xl font-semibold">Recover with your code</h1>
      <input
        className={input}
        name="code"
        placeholder="Recovery code"
        required
        autoComplete="off"
      />
      <input
        className={input}
        name="password"
        type="password"
        placeholder="New password (12+ characters)"
        required
        minLength={12}
        autoComplete="new-password"
      />
      <input
        className={input}
        name="confirm"
        type="password"
        placeholder="Repeat new password"
        required
        autoComplete="new-password"
      />
      {s?.error ? <p className="text-sm text-destructive">{s.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Recovering…" : "Recover"}
      </Button>
    </form>
  );
}
