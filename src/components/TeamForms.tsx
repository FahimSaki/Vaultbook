"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addStaffAction } from "@/app/(app)/team/actions";

const input = "rounded-lg border border-input bg-background px-3 py-2 text-sm";

export function AddStaffForm() {
  const [s, action, pending] = useActionState(addStaffAction, null);
  return (
    <form
      action={action}
      className="flex flex-wrap items-start gap-2"
      autoComplete="off"
    >
      <input name="name" placeholder="Name" required className={input} />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className={input}
      />
      <input
        name="password"
        type="password"
        placeholder="Temporary password (12+)"
        required
        minLength={12}
        autoComplete="new-password"
        className={input}
      />
      <Button type="submit" disabled={pending}>
        Add staff
      </Button>
      {s?.error ? (
        <p className="w-full text-sm text-destructive">{s.error}</p>
      ) : null}
      {s?.ok ? (
        <p className="w-full text-sm text-muted-foreground">Added.</p>
      ) : null}
    </form>
  );
}
