-- Help Desk module (Module 14) — extensions to shared sd_tickets + portal tables

ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS linked_test_case_id INTEGER;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS linked_test_result_id INTEGER;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS sprint_phase TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_severity TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_steps_to_reproduce TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_expected_result TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_actual_result TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_environment TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_build_version TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_workaround TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS defect_fix_version TEXT;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS csat_score INTEGER;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS csat_survey_sent_at TIMESTAMP;
ALTER TABLE sd_tickets ADD COLUMN IF NOT EXISTS csat_survey_token TEXT;

CREATE TABLE IF NOT EXISTS hd_portal_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  allowed_email_domains JSONB DEFAULT '[]',
  allowed_emails JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  custom_branding JSONB DEFAULT '{}',
  portal_name TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS hd_portal_sessions (
  id SERIAL PRIMARY KEY,
  portal_config_id INTEGER NOT NULL REFERENCES hd_portal_configs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verification_code TEXT,
  verified_at TIMESTAMP,
  expires_at TIMESTAMP,
  ip_address TEXT,
  csat_opted_out BOOLEAN DEFAULT FALSE,
  session_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS hd_portal_activity_log (
  id SERIAL PRIMARY KEY,
  portal_config_id INTEGER NOT NULL REFERENCES hd_portal_configs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  ticket_id INTEGER,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS hd_sla_contracted_hours (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  monthly_hours DECIMAL(8,2) NOT NULL,
  overage_rate DECIMAL(10,2),
  currency TEXT DEFAULT 'GBP',
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS hd_maintenance_windows (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS sd_tickets_linked_test_case ON sd_tickets(linked_test_case_id);
CREATE INDEX IF NOT EXISTS hd_portal_configs_tenant ON hd_portal_configs(tenant_id);
