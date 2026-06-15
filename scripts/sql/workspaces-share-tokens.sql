-- Add public share token columns for workspace pages and rows
ALTER TABLE workspace_pages ADD COLUMN IF NOT EXISTS public_token text;
ALTER TABLE workspace_database_rows ADD COLUMN IF NOT EXISTS public_token text;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_pages_public_token_idx ON workspace_pages (public_token) WHERE public_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_rows_public_token_idx ON workspace_database_rows (public_token) WHERE public_token IS NOT NULL;
