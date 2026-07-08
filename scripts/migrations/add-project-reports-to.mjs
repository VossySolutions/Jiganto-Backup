/**
 * Additive migration: resource_allocations.project_reports_to_id
 * Stores who a resource reports to on a specific project (project-level reporting line,
 * distinct from their org line manager). Safe / idempotent.
 *
 * Usage: node scripts/migrations/add-project-reports-to.mjs
 */
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query(
    `ALTER TABLE resource_allocations ADD COLUMN IF NOT EXISTS project_reports_to_id integer`,
  );
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'resource_allocations' AND column_name = 'project_reports_to_id'`,
  );
  console.log(rows.length ? "OK: project_reports_to_id present on resource_allocations" : "FAILED: column missing");
} finally {
  client.release();
  await pool.end();
}
