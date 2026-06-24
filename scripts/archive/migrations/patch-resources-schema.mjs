import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const statements = [
  `ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending'`,
  `ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS rejection_reason text`,
  `ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS approved_by_id varchar`,
  `ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS approved_at timestamp`,
  `ALTER TABLE timesheet_integration_log ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0`,
  `ALTER TABLE timesheet_integration_log ADD COLUMN IF NOT EXISTS next_retry_at timestamp`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS timesheet_period_id integer`,
  `CREATE TABLE IF NOT EXISTS document_resource_links (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    document_id integer NOT NULL,
    resource_id integer NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    link_type text DEFAULT 'general',
    notes text,
    created_by_id varchar,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
];

try {
  for (const sql of statements) {
    await pool.query(sql);
    console.log("OK:", sql.slice(0, 60));
  }
  console.log("Schema patch applied");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
