import { z } from "zod";
import { MAX_CENTS } from "./money";

export const ProductFields = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(64),
  name: z.string().trim().min(1, "Name is required").max(200),
  categoryId: z.uuid().nullish(),
  description: z.string().trim().max(2000).nullish(),
  sellPriceCents: z.number().int().min(0).max(MAX_CENTS),
  currency: z.string().nullish(), // normalized in the service
  reorderLevel: z.number().int().min(0).max(1_000_000).default(0),
});
export const ProductInput = ProductFields.extend({
  initialStock: z.number().int().min(0).max(1_000_000).default(0),
  costCents: z.number().int().min(0).max(MAX_CENTS).nullish(),
});

export const MovementSchema = z.object({
  productId: z.uuid(),
  type: z.enum(["purchase", "sale", "adjustment"]),
  qty: z
    .number()
    .int("Quantity must be a whole number")
    .min(-1_000_000)
    .max(1_000_000),
  note: z.string().trim().max(500).nullish(),
  unitCostCents: z.number().int().min(0).max(MAX_CENTS).nullish(),
});
export type MovementInput = z.infer<typeof MovementSchema>;

export type ProductDTO = {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  description: string | null;
  sellPriceCents: number;
  currency: string;
  stockOnHand: number;
  reorderLevel: number;
  lowStock: boolean;
};
export type ProductOwnerDTO = ProductDTO & {
  costCents: number | null;
  marginPercent: number | null;
};
