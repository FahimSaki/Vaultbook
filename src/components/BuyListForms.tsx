"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form";
import { addBuyItemAction } from "@/app/(app)/buylist/actions";

const input = "rounded-lg border border-input bg-background px-3 py-2 text-sm";

export function AddBuyItemForm({
  products,
}: {
  products: { id: string; label: string }[];
}) {
  const [s, action, pending] = useActionState(addBuyItemAction, null);
  return (
    <form
      action={action}
      className="flex flex-wrap items-start gap-2"
      autoComplete="off"
    >
      <select name="productId" className={input} defaultValue="">
        <option value="">Free text item…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        name="freeText"
        placeholder="What do you need?"
        className={input}
      />
      <input
        name="qty"
        type="number"
        min={1}
        defaultValue={1}
        className={input + " w-20"}
      />
      <Button type="submit" disabled={pending}>
        Add
      </Button>
      {s?.error ? (
        <p className="w-full text-sm text-destructive">{s.error}</p>
      ) : null}
    </form>
  );
}

export function ReceiveForm({
  action,
  qty,
  showCost,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  qty: number;
  showCost: boolean;
}) {
  const [s, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2"
      autoComplete="off"
    >
      <input
        name="qty"
        type="number"
        min={1}
        defaultValue={qty}
        className={input + " w-20"}
      />
      {showCost ? (
        <input
          name="cost"
          inputMode="decimal"
          placeholder="Unit cost"
          className={input + " w-28"}
        />
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        Receive
      </Button>
      {s?.error ? (
        <span className="text-sm text-destructive">{s.error}</span>
      ) : null}
    </form>
  );
}
