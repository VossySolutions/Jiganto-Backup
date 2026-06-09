-- Performance indexes for Clients module APIs (idempotent)

CREATE INDEX IF NOT EXISTS clients_tenant_status_idx ON clients (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_slug_idx ON clients (tenant_id, slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_users_client_id_idx ON client_users (client_id);
CREATE INDEX IF NOT EXISTS client_users_tenant_user_idx ON client_users (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS client_users_tenant_user_active_idx ON client_users (tenant_id, user_id, is_active);

CREATE INDEX IF NOT EXISTS client_invitations_client_id_idx ON client_invitations (client_id);
CREATE INDEX IF NOT EXISTS client_invitations_token_idx ON client_invitations (token);

CREATE INDEX IF NOT EXISTS pm_projects_tenant_client_idx ON pm_projects (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS pm_projects_tenant_status_idx ON pm_projects (tenant_id, status);
