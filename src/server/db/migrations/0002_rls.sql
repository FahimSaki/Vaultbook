-- Hosted editions only. Requires the vb_app role (created by db/init/00-roles.sh).
GRANT USAGE ON SCHEMA public TO vb_app;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON categories,
    products,
    product_images,
    buy_list_items TO vb_app;
GRANT SELECT,
    INSERT ON price_history,
    stock_movements,
    cost_history,
    audit_log TO vb_app;
GRANT SELECT ON organizations TO vb_app;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON memberships TO vb_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO vb_app;
CREATE FUNCTION app_org() RETURNS uuid LANGUAGE sql STABLE AS $$
SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
CREATE FUNCTION app_user() RETURNS text LANGUAGE sql STABLE AS $$
SELECT nullif(current_setting('app.user_id', true), '') $$;
CREATE FUNCTION app_is_owner() RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT coalesce(current_setting('app.role', true), '') = 'owner' $$;
-- Tenant isolation on every shop-scoped table
DO $$
DECLARE t text;
BEGIN FOREACH t IN ARRAY ARRAY ['categories','products','product_images','price_history',
                           'stock_movements','buy_list_items'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
EXECUTE format(
    'CREATE POLICY tenant_isolation ON %I
                    USING (org_id = app_org()) WITH CHECK (org_id = app_org())',
    t
);
END LOOP;
END $$;
-- Owner-only costs
ALTER TABLE cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_history FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON cost_history USING (
    org_id = app_org()
    AND app_is_owner()
) WITH CHECK (
    org_id = app_org()
    AND app_is_owner()
);
-- Audit log: anyone in the shop writes, only the owner reads
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_insert ON audit_log FOR
INSERT WITH CHECK (org_id = app_org());
CREATE POLICY audit_read ON audit_log FOR
SELECT USING (
        org_id = app_org()
        AND app_is_owner()
    );
-- Organizations (insert policy comes in 0004_signup.sql)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY org_self ON organizations FOR
SELECT USING (id = app_org());
-- Memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY member_read ON memberships FOR
SELECT USING (
        user_id = app_user()
        OR org_id = app_org()
    );
CREATE POLICY member_insert ON memberships FOR
INSERT WITH CHECK (
        org_id = app_org()
        AND app_is_owner()
    );
CREATE POLICY member_update ON memberships FOR
UPDATE USING (
        org_id = app_org()
        AND app_is_owner()
    ) WITH CHECK (
        org_id = app_org()
        AND app_is_owner()
    );
CREATE POLICY member_delete ON memberships FOR DELETE USING (
    org_id = app_org()
    AND app_is_owner()
    AND role = 'staff'
);
-- Staff may change stock but not selling prices
CREATE FUNCTION guard_price_change() RETURNS trigger AS $$ BEGIN IF NEW.sell_price_cents IS DISTINCT
FROM OLD.sell_price_cents
    AND NOT app_is_owner() THEN RAISE EXCEPTION 'only the owner can change prices' USING ERRCODE = '42501';
END IF;
RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_guard_price BEFORE
UPDATE ON products FOR EACH ROW EXECUTE FUNCTION guard_price_change();