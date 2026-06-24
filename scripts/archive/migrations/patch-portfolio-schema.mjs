import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const statements = [
  `ALTER TABLE pm_portfolios ADD COLUMN IF NOT EXISTS colour text DEFAULT '#7C3AED'`,
  `ALTER TABLE pm_milestones ADD COLUMN IF NOT EXISTS ref text`,
  `CREATE TABLE IF NOT EXISTS pm_project_portfolios (
    id serial PRIMARY KEY,
    project_id integer NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
    portfolio_id integer NOT NULL REFERENCES pm_portfolios(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pm_project_portfolios_unique ON pm_project_portfolios(project_id, portfolio_id)`,
  `CREATE TABLE IF NOT EXISTS pm_report_schedules (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    report_type text NOT NULL,
    project_id integer REFERENCES pm_projects(id) ON DELETE CASCADE,
    portfolio_id integer REFERENCES pm_portfolios(id) ON DELETE CASCADE,
    frequency text DEFAULT 'weekly',
    day_of_week integer,
    time_of_day text DEFAULT '09:00',
    recipient_ids jsonb DEFAULT '[]',
    format text DEFAULT 'pdf',
    last_run_at timestamp,
    created_by varchar,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS pm_report_snapshots (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    report_type text NOT NULL,
    project_id integer REFERENCES pm_projects(id) ON DELETE SET NULL,
    portfolio_id integer REFERENCES pm_portfolios(id) ON DELETE SET NULL,
    content_json jsonb NOT NULL,
    generated_at timestamp DEFAULT CURRENT_TIMESTAMP,
    generated_by varchar
  )`,
  `CREATE TABLE IF NOT EXISTS pm_health_matrix_snapshots (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    project_id integer NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
    snapshot_week date NOT NULL,
    overall text DEFAULT 'green',
    schedule text DEFAULT 'green',
    budget text DEFAULT 'green',
    quality text DEFAULT 'green',
    delivery text DEFAULT 'green',
    risk text DEFAULT 'green',
    resources text DEFAULT 'green',
    stakeholders text DEFAULT 'green',
    health_score integer DEFAULT 100,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, snapshot_week)
  )`,
  `CREATE TABLE IF NOT EXISTS pm_custom_reports (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    name text NOT NULL,
    description text,
    data_source text NOT NULL DEFAULT 'projects',
    config jsonb NOT NULL,
    created_by varchar,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP
  )`,
];

try {
  for (const sql of statements) {
    await pool.query(sql);
    console.log("OK:", sql.slice(0, 70));
  }
  console.log("Portfolio schema patch applied");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
