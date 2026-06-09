-- Clients module v1 — engagement fields, module visibility, invitations, soft-delete

ALTER TABLE clients ADD COLUMN IF NOT EXISTS engagement_status text NOT NULL DEFAULT 'active';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS account_manager_id varchar REFERENCES users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by varchar REFERENCES users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS purge_at timestamptz;

ALTER TABLE clients ALTER COLUMN short_code TYPE varchar(5);

ALTER TABLE client_users ADD COLUMN IF NOT EXISTS member_type text NOT NULL DEFAULT 'client';
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS invited_by text;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS joined_at timestamptz;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS is_active integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS client_module_visibility (
  id serial PRIMARY KEY,
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_visible integer NOT NULL DEFAULT 0,
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (client_id, module_key)
);

CREATE TABLE IF NOT EXISTS client_invitations (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  member_type text NOT NULL DEFAULT 'client',
  token text NOT NULL UNIQUE,
  invited_by text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_invitations_token ON client_invitations(token);
CREATE INDEX IF NOT EXISTS idx_clients_purge_at ON clients(purge_at) WHERE purge_at IS NOT NULL;
