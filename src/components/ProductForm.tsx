"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form";

const input =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

type P = {
  sku: string;
  name: string;
  categoryId: string | null;
  description: string | null;
  sellPriceCents: number;
  currency: string;
  reorderLevel: number;
};

export function ProductForm({
  action,
  categories,
  currencies,
  showCost,
  product,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  categories: { id: string; name: string }[];
  currencies: string[];
  showCost: boolean;
  product?: P;
}) {
  const [s, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="max-w-md space-y-3" autoComplete="off">
      <input
        className={input}
        name="sku"
        placeholder="SKU"
        required
        defaultValue={product?.sku}
      />
      <input
        className={input}
        name="name"
        placeholder="Name"
        required
        defaultValue={product?.name}
      />
      <select
        className={input}
        name="categoryId"
        defaultValue={product?.categoryId ?? ""}
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <textarea
        className={input}
        name="description"
        placeholder="Description"
        rows={3}
        defaultValue={product?.description ?? ""}
      />
      <div className="flex gap-2">
        <input
          className={input}
          name="price"
          placeholder="Selling price"
          inputMode="decimal"
          required
          defaultValue={
            product ? (product.sellPriceCents / 100).toFixed(2) : undefined
          }
        />
        <input
          className={input + " w-24 uppercase"}
          name="currency"
          list="currencies"
          maxLength={3}
          placeholder="BDT"
          aria-label="Currency (blank means BDT)"
          defaultValue={product?.currency}
        />
        <datalist id="currencies">
          {currencies.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <input
        className={input}
        name="reorderLevel"
        type="number"
        min={0}
        placeholder="Reorder level"
        defaultValue={product?.reorderLevel}
      />
      {!product ? (
        <>
          <input
            className={input}
            name="initialStock"
            type="number"
            min={0}
            placeholder="Opening stock"
          />
          {showCost ? (
            <input
              className={input}
              name="cost"
              inputMode="decimal"
              placeholder="Unit cost (owner only)"
            />
          ) : null}
        </>
      ) : null}
      {s?.error ? <p className="text-sm text-destructive">{s.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
