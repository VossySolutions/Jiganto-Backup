-- Service Desk module (Module 13) — shared ticket model with Help Desk via source field

CREATE TABLE IF NOT EXISTS sd_settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL UNIQUE,
  sd_ref_prefix TEXT NOT NULL DEFAULT 'SD',
  hd_ref_prefix TEXT NOT NULL DEFAULT 'HD',
  next_sd_number INTEGER NOT NULL DEFAULT 1,
  next_hd_number INTEGER NOT NULL DEFAULT 1,
  default_team_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_service_categories (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_agent_teams (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  lead_user_id VARCHAR REFERENCES users(id),
  round_robin_enabled BOOLEAN DEFAULT FALSE,
  round_robin_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_agent_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES sd_agent_teams(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS sd_services (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  category_id INTEGER REFERENCES sd_service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  owner_team_id INTEGER REFERENCES sd_agent_teams(id) ON DELETE SET NULL,
  availability TEXT NOT NULL DEFAULT 'business_hours',
  cost_model TEXT DEFAULT 'included',
  cost_notes TEXT,
  request_form_fields JSONB DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'all_clients',
  visible_client_ids JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_service_slas (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES sd_services(id) ON DELETE CASCADE,
  priority TEXT NOT NULL,
  response_hours DECIMAL(8,2) NOT NULL,
  resolution_hours DECIMAL(8,2) NOT NULL,
  UNIQUE(service_id, priority)
);

CREATE TABLE IF NOT EXISTS sd_routing_rules (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_sla_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  priority TEXT NOT NULL,
  response_hours DECIMAL(8,2) NOT NULL,
  resolution_hours DECIMAL(8,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_tickets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'service_desk',
  ref TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'p3',
  status TEXT NOT NULL DEFAULT 'open',
  description JSONB,
  category TEXT,
  service_id INTEGER REFERENCES sd_services(id) ON DELETE SET NULL,
  custom_fields JSONB DEFAULT '{}',
  reporter_id VARCHAR REFERENCES users(id),
  reporter_email TEXT,
  assigned_agent_id VARCHAR REFERENCES users(id),
  assigned_team_id INTEGER REFERENCES sd_agent_teams(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES pm_projects(id) ON DELETE SET NULL,
  sla_response_deadline TIMESTAMP,
  sla_resolution_deadline TIMESTAMP,
  sla_paused_at TIMESTAMP,
  sla_paused_ms INTEGER DEFAULT 0,
  first_response_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  change_justification TEXT,
  change_risk_assessment TEXT,
  change_rollback_plan TEXT,
  change_implementation_date TIMESTAMP,
  change_post_review TEXT,
  internal_notes TEXT,
  tags JSONB DEFAULT '[]',
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sd_tickets_tenant_ref ON sd_tickets(tenant_id, ref);
CREATE INDEX IF NOT EXISTS sd_tickets_tenant_status ON sd_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS sd_tickets_tenant_source ON sd_tickets(tenant_id, source);
CREATE INDEX IF NOT EXISTS sd_tickets_client ON sd_tickets(client_id);
CREATE INDEX IF NOT EXISTS sd_tickets_assigned ON sd_tickets(assigned_agent_id);

CREATE TABLE IF NOT EXISTS sd_ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES sd_tickets(id) ON DELETE CASCADE,
  author_id VARCHAR REFERENCES users(id),
  body JSONB,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES sd_tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_ticket_time_logs (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES sd_tickets(id) ON DELETE CASCADE,
  agent_id VARCHAR NOT NULL REFERENCES users(id),
  log_date DATE NOT NULL,
  hours DECIMAL(6,2) NOT NULL,
  description TEXT,
  is_billable BOOLEAN DEFAULT TRUE,
  rate DECIMAL(10,2),
  finance_timesheet_entry_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_ticket_status_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES sd_tickets(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by VARCHAR REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sd_cab_reviews (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES sd_tickets(id) ON DELETE CASCADE,
  reviewer_id VARCHAR NOT NULL REFERENCES users(id),
  decision TEXT,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(ticket_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS sd_cab_members (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(tenant_id, user_id)
);
