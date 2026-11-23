"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { RecoveryCode } from "@/components/AuthForms";
import { changePasswordAction } from "@/app/(app)/settings/actions";

const input =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

export function ChangePasswordForm() {
  const [s, action, pending] = useActionState(changePasswordAction, null);
  if (s?.recovery) return <RecoveryCode code={s.recovery} href="/settings" />;
  return (
    <form action={action} className="max-w-sm space-y-3" autoComplete="off">
      <input
        className={input}
        name="current"
        type="password"
        placeholder="Current password"
        required
        autoComplete="off"
      />
      <input
        className={input}
        name="next"
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
        {pending ? "Saving…" : "Change password and get a new recovery code"}
      </Button>
    </form>
  );
}
