CREATE TYPE member_role AS ENUM ('owner', 'staff');
CREATE TYPE movement_type AS ENUM ('purchase', 'sale', 'adjustment');
CREATE TYPE buy_status AS ENUM ('open', 'ordered', 'received', 'dismissed');
CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    wrapped_dek bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
    user_id text NOT NULL,
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role member_role NOT NULL,
    PRIMARY KEY (user_id, org_id)
);
CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    UNIQUE (org_id, name)
);
CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id uuid REFERENCES categories(id) ON DELETE
    SET NULL,
        sku text NOT NULL,
        name text NOT NULL,
        description text,
        sell_price_cents integer NOT NULL CHECK (sell_price_cents >= 0),
        reorder_level integer NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
        stock_on_hand integer NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (org_id, sku)
);
CREATE INDEX products_org_name_idx ON products (org_id, lower(name));
CREATE INDEX products_low_stock_idx ON products (org_id)
WHERE archived_at IS NULL
    AND stock_on_hand <= reorder_level;
CREATE TABLE product_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    storage_key text NOT NULL,
    thumb_key text NOT NULL,
    position integer NOT NULL DEFAULT 0
);
CREATE INDEX product_images_product_idx ON product_images (org_id, product_id, position);
CREATE TABLE price_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_cents integer NOT NULL,
    changed_by text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_history_product_idx ON price_history (org_id, product_id, changed_at DESC);
CREATE TABLE stock_movements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type movement_type NOT NULL,
    qty integer NOT NULL CHECK (qty <> 0),
    note text,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (
            type = 'purchase'
            AND qty > 0
        )
        OR (
            type = 'sale'
            AND qty < 0
        )
        OR type = 'adjustment'
    )
);
CREATE INDEX stock_movements_product_idx ON stock_movements (org_id, product_id, created_at DESC);
CREATE TABLE cost_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    cost_enc bytea NOT NULL,
    movement_id bigint REFERENCES stock_movements(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cost_history_product_idx ON cost_history (org_id, product_id, created_at DESC);
CREATE TABLE buy_list_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    free_text text,
    qty_needed integer NOT NULL CHECK (qty_needed > 0),
    status buy_status NOT NULL DEFAULT 'open',
    auto_suggested boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        product_id IS NOT NULL
        OR free_text IS NOT NULL
    )
);
CREATE UNIQUE INDEX buy_list_one_open_per_product ON buy_list_items (org_id, product_id)
WHERE status = 'open'
    AND product_id IS NOT NULL;
CREATE TABLE audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id text,
    detail jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Apply each movement to cached stock.
CREATE FUNCTION apply_stock_movement() RETURNS trigger AS $$ BEGIN
UPDATE products
SET stock_on_hand = stock_on_hand + NEW.qty
WHERE id = NEW.product_id
    AND org_id = NEW.org_id;
RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_apply_stock_movement
AFTER
INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();
-- Record every selling-price change.
CREATE FUNCTION log_price_change() RETURNS trigger AS $$ BEGIN IF TG_OP = 'INSERT'
OR NEW.sell_price_cents IS DISTINCT
FROM OLD.sell_price_cents THEN
INSERT INTO price_history (org_id, product_id, price_cents, changed_by)
VALUES (
        NEW.org_id,
        NEW.id,
        NEW.sell_price_cents,
        coalesce(current_setting('app.user_id', true), 'system')
    );
END IF;
RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_log_price_change
AFTER
INSERT
    OR
UPDATE OF sell_price_cents ON products FOR EACH ROW EXECUTE FUNCTION log_price_change();
-- Block UPDATE and DELETE on append-only tables.
CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION '% is append-only',
TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_no_mutate_movements BEFORE
UPDATE
    OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER trg_no_mutate_prices BEFORE
UPDATE
    OR DELETE ON price_history FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER trg_no_mutate_costs BEFORE
UPDATE
    OR DELETE ON cost_history FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER trg_no_mutate_audit BEFORE
UPDATE
    OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION forbid_mutation();