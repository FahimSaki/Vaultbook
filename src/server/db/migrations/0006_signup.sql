GRANT INSERT ON organizations TO vb_app;
CREATE POLICY org_create ON organizations FOR
INSERT WITH CHECK (id = app_org());