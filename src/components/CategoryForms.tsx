"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { renameCategoryAction } from "@/app/(app)/categories/actions";

export function RenameCategoryForm({ id, name }: { id: string; name: string }) {
  const [s, action, pending] = useActionState(
    renameCategoryAction.bind(null, id),
    null,
  );
  return (
    <form
      action={action}
      className="flex flex-1 items-center gap-2"
      autoComplete="off"
    >
      <input
        name="name"
        defaultValue={name}
        required
        maxLength={100}
        aria-label={`Rename ${name}`}
        className="w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Rename
      </Button>
      {s?.error ? (
        <span className="text-xs text-destructive">{s.error}</span>
      ) : null}
    </form>
  );
}
