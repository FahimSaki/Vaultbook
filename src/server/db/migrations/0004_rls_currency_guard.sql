-- Hosted editions only (filename contains "rls", so portable skips it).
-- Staff may not change a product's currency, just like they may not change its price.
CREATE OR REPLACE FUNCTION guard_price_change() RETURNS trigger AS $$ BEGIN IF (
        NEW.sell_price_cents IS DISTINCT
        FROM OLD.sell_price_cents
            OR NEW.currency IS DISTINCT
        FROM OLD.currency
    )
    AND NOT app_is_owner() THEN RAISE EXCEPTION 'only the owner can change prices' USING ERRCODE = '42501';
END IF;
RETURN NEW;
END $$ LANGUAGE plpgsql;