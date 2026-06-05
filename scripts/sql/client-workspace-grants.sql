-- Section 4 — optional SI consultant workspace grants (empty = all clients)
CREATE TABLE IF NOT EXISTS client_workspace_grants (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_workspace_grants_user_idx
  ON client_workspace_grants (user_id, tenant_id);
