-- AI token balance, usage log, and limits (spec docs/18.png)
CREATE TABLE IF NOT EXISTS ai_token_balance (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  monthly_allocation INTEGER NOT NULL DEFAULT 100000,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id)
);

CREATE TABLE IF NOT EXISTS ai_token_usage (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  tokens_consumed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_org_created
  ON ai_token_usage (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_token_limits (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module TEXT,
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
