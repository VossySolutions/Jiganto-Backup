-- Organisation audit trail (invitations, platform roles, workspace grants).
CREATE TABLE IF NOT EXISTS org_audit_events (
  id serial PRIMARY KEY,
  org_id integer NOT NULL,
  actor_user_id varchar NOT NULL REFERENCES users(id),
  action text NOT NULL,
  target_user_id varchar,
  target_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_audit_events_org_idx ON org_audit_events (org_id, created_at DESC);
