import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  customType,
  primaryKey,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => Buffer.from(v), // pg returns Buffer, PGlite returns Uint8Array
  toDriver: (v) => v,
});
const ts = (name: string) => timestamp(name, { withTimezone: true });
const bigId = () =>
  bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();

export const memberRole = pgEnum("member_role", ["owner", "staff"]);
export const movementType = pgEnum("movement_type", [
  "purchase",
  "sale",
  "adjustment",
]);
export const buyStatus = pgEnum("buy_status", [
  "open",
  "ordered",
  "received",
  "dismissed",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  wrappedDek: bytea("wrapped_dek").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id").notNull(),
    orgId: uuid("org_id").notNull(),
    role: memberRole("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  categoryId: uuid("category_id"),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sellPriceCents: integer("sell_price_cents").notNull(),
  reorderLevel: integer("reorder_level").notNull().default(0),
  stockOnHand: integer("stock_on_hand").notNull().default(0),
  archivedAt: ts("archived_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  productId: uuid("product_id").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbKey: text("thumb_key").notNull(),
  position: integer("position").notNull().default(0),
});

export const priceHistory = pgTable("price_history", {
  id: bigId(),
  orgId: uuid("org_id").notNull(),
  productId: uuid("product_id").notNull(),
  priceCents: integer("price_cents").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: ts("changed_at").notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: bigId(),
  orgId: uuid("org_id").notNull(),
  productId: uuid("product_id").notNull(),
  type: movementType("type").notNull(),
  qty: integer("qty").notNull(),
  note: text("note"),
  createdBy: text("created_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const costHistory = pgTable("cost_history", {
  id: bigId(),
  orgId: uuid("org_id").notNull(),
  productId: uuid("product_id").notNull(),
  costEnc: bytea("cost_enc").notNull(),
  movementId: bigint("movement_id", { mode: "number" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const buyListItems = pgTable("buy_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  productId: uuid("product_id"),
  freeText: text("free_text"),
  qtyNeeded: integer("qty_needed").notNull(),
  status: buyStatus("status").notNull().default("open"),
  autoSuggested: boolean("auto_suggested").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigId(),
  orgId: uuid("org_id").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  detail: jsonb("detail"),
  createdAt: ts("created_at").notNull().defaultNow(),
});
