ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS client_id INTEGER;
CREATE INDEX IF NOT EXISTS initiatives_tenant_client_idx ON initiatives (tenant_id, client_id);
