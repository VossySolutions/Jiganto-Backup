/**
 * Additive migration for the Skills Matrix feature:
 *   - skills.parent_skill_id     → nested skills (e.g. SAP S/4HANA → FICO / MM-SD modules)
 *   - skills.order               → manual ordering within a category
 *   - resource_skills.assessment_type → 'validated' | 'self' | 'pending'
 * Safe / idempotent.
 *
 * Usage: node scripts/migrations/add-skill-hierarchy-assessment.mjs
 */
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query(`ALTER TABLE skills ADD COLUMN IF NOT EXISTS parent_skill_id integer`);
  await client.query(`ALTER TABLE skills ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0`);
  await client.query(`ALTER TABLE resource_skills ADD COLUMN IF NOT EXISTS assessment_type text DEFAULT 'validated'`);

  const { rows } = await client.query(
    `SELECT
       (SELECT count(*) FROM information_schema.columns WHERE table_name='skills' AND column_name='parent_skill_id') AS a,
       (SELECT count(*) FROM information_schema.columns WHERE table_name='skills' AND column_name='order') AS b,
       (SELECT count(*) FROM information_schema.columns WHERE table_name='resource_skills' AND column_name='assessment_type') AS c`,
  );
  const ok = rows[0].a > 0 && rows[0].b > 0 && rows[0].c > 0;
  console.log(ok ? "OK: skill hierarchy + assessment columns present" : "FAILED: some columns missing");
} finally {
  client.release();
  await pool.end();
}
