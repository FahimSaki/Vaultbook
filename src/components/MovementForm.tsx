"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { recordMovementAction } from "@/app/(app)/products/actions";

const input = "rounded-lg border border-input bg-background px-3 py-2 text-sm";

export function MovementForm({
  productId,
  showCost,
}: {
  productId: string;
  showCost: boolean;
}) {
  const [s, action, pending] = useActionState(recordMovementAction, null);
  return (
    <form
      action={action}
      className="flex flex-wrap items-start gap-2"
      autoComplete="off"
    >
      <input type="hidden" name="productId" value={productId} />
      <select name="type" className={input} defaultValue="sale">
        <option value="purchase">Receive</option>
        <option value="sale">Sell</option>
        <option value="adjustment">Adjust (+/-)</option>
      </select>
      <input
        name="qty"
        type="number"
        step={1}
        required
        placeholder="Qty"
        className={input + " w-24"}
      />
      {showCost ? (
        <input
          name="cost"
          inputMode="decimal"
          placeholder="Unit cost"
          className={input + " w-28"}
        />
      ) : null}
      <input name="note" placeholder="Note" className={input + " w-40"} />
      <Button type="submit" disabled={pending}>
        Record
      </Button>
      {s?.error ? (
        <p className="w-full text-sm text-destructive">{s.error}</p>
      ) : null}
      {s?.ok ? (
        <p className="w-full text-sm text-muted-foreground">Saved.</p>
      ) : null}
    </form>
  );
}
