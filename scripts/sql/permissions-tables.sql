-- Run in Supabase: SQL Editor → New query → paste → Run
-- Creates permission tables added for Section 3 (faster than full drizzle push on large DBs)

CREATE TABLE IF NOT EXISTS org_memberships (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL,
  platform_role TEXT NOT NULL,
  locked_workspace_id INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_memberships_user_org_idx
  ON org_memberships (user_id, org_id);

CREATE TABLE IF NOT EXISTS staff_impersonation_logs (
  id SERIAL PRIMARY KEY,
  staff_user_id VARCHAR NOT NULL REFERENCES users(id),
  target_user_id VARCHAR NOT NULL REFERENCES users(id),
  org_id INTEGER NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by VARCHAR,
  reason TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE boards ADD COLUMN IF NOT EXISTS workspace_id INTEGER;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT;

-- Dev admin membership (adjust user_id if needed — from users table after login)
INSERT INTO org_memberships (user_id, org_id, platform_role, is_active)
SELECT 'local-dev-user', 1, 'si_super_admin', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM org_memberships
  WHERE user_id = 'local-dev-user' AND org_id = 1
);
