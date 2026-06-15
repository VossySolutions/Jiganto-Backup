-- Workspaces module v2 — spec-complete extensions
-- Run after drizzle push or alongside db:push

ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS permission text DEFAULT 'edit';
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invited_by varchar REFERENCES users(id);

ALTER TABLE workspace_database_columns ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;

ALTER TABLE workspace_databases ADD COLUMN IF NOT EXISTS project_id integer;

ALTER TABLE workspace_pages ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE workspace_pages ADD COLUMN IF NOT EXISTS share_permission text DEFAULT 'inherit';
ALTER TABLE workspace_pages ADD COLUMN IF NOT EXISTS linked_document_id integer;

CREATE TABLE IF NOT EXISTS workspace_access_log (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id),
  accessed_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspace_access_user ON workspace_access_log(user_id, accessed_at DESC);

CREATE TABLE IF NOT EXISTS workspace_row_comments (
  id serial PRIMARY KEY,
  row_id integer NOT NULL REFERENCES workspace_database_rows(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id),
  body text NOT NULL,
  parent_id integer REFERENCES workspace_row_comments(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_row_attachments (
  id serial PRIMARY KEY,
  row_id integer NOT NULL REFERENCES workspace_database_rows(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  created_by varchar REFERENCES users(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_row_activity (
  id serial PRIMARY KEY,
  row_id integer NOT NULL REFERENCES workspace_database_rows(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id),
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_page_versions (
  id serial PRIMARY KEY,
  page_id integer NOT NULL REFERENCES workspace_pages(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  version integer NOT NULL DEFAULT 1,
  author_id varchar REFERENCES users(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_page_comments (
  id serial PRIMARY KEY,
  page_id integer NOT NULL REFERENCES workspace_pages(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id),
  content text NOT NULL,
  parent_id integer REFERENCES workspace_page_comments(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_document_copies (
  id serial PRIMARY KEY,
  workspace_page_id integer NOT NULL REFERENCES workspace_pages(id) ON DELETE CASCADE,
  document_id integer NOT NULL,
  copied_by varchar REFERENCES users(id),
  copied_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_templates (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  category text,
  tier text DEFAULT 'system',
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by varchar REFERENCES users(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_presence (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id),
  editing_page_id integer,
  editing_row_id integer,
  last_seen_at timestamp DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_database_rows ADD COLUMN IF NOT EXISTS locked_by varchar REFERENCES users(id);
ALTER TABLE workspace_database_rows ADD COLUMN IF NOT EXISTS locked_at timestamp;
ALTER TABLE workspace_database_rows ADD COLUMN IF NOT EXISTS created_by varchar REFERENCES users(id);
