import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const statements = [
  `CREATE TABLE IF NOT EXISTS crm_custom_fields (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    options JSONB,
    position INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS crm_territories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER,
    manager_user_id VARCHAR,
    criteria JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS crm_automation_rules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    entity_type TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_conditions JSONB,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_by_user_id VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `ALTER TABLE crm_accounts ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE crm_pipelines ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false`,
  `ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS revenue numeric(15,2)`,
  `ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS gross_profit numeric(15,2)`,
  `ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false`,
  `ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS document_id integer REFERENCES documents(id) ON DELETE SET NULL`,
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});

for (const sql of statements) {
  try {
    await pool.query(sql);
    console.log("OK:", sql);
  } catch (err) {
    console.error("ERR:", err.message, "\n ", sql);
    process.exitCode = 1;
  }
}

await pool.end();
console.log("Done.");
