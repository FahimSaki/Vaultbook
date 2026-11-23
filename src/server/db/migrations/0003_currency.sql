-- Per-product currency. Amounts stay integer minor units (x100); the code is only a label.
-- Existing rows (and old vaults, which run this on unlock) become BDT.
ALTER TABLE products
ADD COLUMN currency text NOT NULL DEFAULT 'BDT' CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE price_history
ADD COLUMN currency text NOT NULL DEFAULT 'BDT' CHECK (currency ~ '^[A-Z]{3}$');
-- Log a history row when the price OR the currency changes.
CREATE OR REPLACE FUNCTION log_price_change() RETURNS trigger AS $$ BEGIN IF TG_OP = 'INSERT'
    OR NEW.sell_price_cents IS DISTINCT
FROM OLD.sell_price_cents
    OR NEW.currency IS DISTINCT
FROM OLD.currency THEN
INSERT INTO price_history (
        org_id,
        product_id,
        price_cents,
        currency,
        changed_by
    )
VALUES (
        NEW.org_id,
        NEW.id,
        NEW.sell_price_cents,
        NEW.currency,
        coalesce(current_setting('app.user_id', true), 'system')
    );
END IF;
RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER trg_log_price_change ON products;
CREATE TRIGGER trg_log_price_change
AFTER
INSERT
    OR
UPDATE OF sell_price_cents,
    currency ON products FOR EACH ROW EXECUTE FUNCTION log_price_change();