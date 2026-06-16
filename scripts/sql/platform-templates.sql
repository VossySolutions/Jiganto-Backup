-- Module 20 — Platform Templates registry
-- Run via: npm run db:push  OR apply this SQL manually

CREATE TABLE IF NOT EXISTS platform_templates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  category_tags TEXT[],
  tier TEXT NOT NULL DEFAULT 'customer',
  submission_status TEXT NOT NULL DEFAULT 'none',
  submission_note TEXT,
  reviewer_note TEXT,
  contributor_org_id INTEGER REFERENCES tenants(id),
  show_contributor_credit BOOLEAN DEFAULT false,
  source_module TEXT,
  source_id INTEGER,
  snapshot_jsonb JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'active',
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  marketplace_listed BOOLEAN DEFAULT false,
  marketplace_featured BOOLEAN DEFAULT false,
  created_by VARCHAR REFERENCES users(id),
  created_by_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_usage_log (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES platform_templates(id) ON DELETE CASCADE,
  used_by VARCHAR REFERENCES users(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  target_module TEXT NOT NULL,
  target_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_ai_generations (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES platform_templates(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  model_used TEXT,
  tokens_consumed INTEGER DEFAULT 0,
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by VARCHAR REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_templates_tenant ON platform_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_templates_module ON platform_templates(module);
CREATE INDEX IF NOT EXISTS idx_platform_templates_tier ON platform_templates(tier);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_template ON template_usage_log(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_user ON template_usage_log(used_by, tenant_id);
