import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS languages TEXT`,
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS grade TEXT`,
  `ALTER TABLE resource_allocations ADD COLUMN IF NOT EXISTS opportunity_row_id INTEGER`,
  `CREATE TABLE IF NOT EXISTS recruitment_recommendations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    skill_or_role TEXT NOT NULL,
    grade TEXT,
    headcount INTEGER DEFAULT 1 NOT NULL,
    target_month TEXT,
    latest_start_date TIMESTAMP,
    go_live_date TIMESTAMP,
    time_to_hire_weeks INTEGER DEFAULT 8,
    estimated_cost DECIMAL(12, 2),
    currency TEXT DEFAULT 'GBP',
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    recommendation_type TEXT DEFAULT 'shortage',
    action_text TEXT,
    source_demand_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resource_planning_scenarios (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    scenario_type TEXT DEFAULT 'expected',
    probability_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    revenue_forecast DECIMAL(15, 2),
    demand_fte DECIMAL(8, 1),
    utilisation_forecast INTEGER,
    shortfall_fte DECIMAL(8, 1),
    assumptions JSONB,
    actions JSONB,
    is_default BOOLEAN DEFAULT false,
    created_by_id VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resource_planning_audit_log (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    actor_user_id VARCHAR,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
];

async function main() {
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
      console.log("OK:", sql.slice(0, 60).replace(/\s+/g, " ") + "...");
    }
    console.log("Resource Planning schema patch complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
