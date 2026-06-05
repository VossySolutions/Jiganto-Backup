-- Section 4 — scope documents to client workspaces
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id INTEGER;
ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS client_id INTEGER;

CREATE INDEX IF NOT EXISTS documents_tenant_client_idx ON documents (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS document_folders_tenant_client_idx ON document_folders (tenant_id, client_id);
