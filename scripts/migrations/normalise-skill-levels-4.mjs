/**
 * Normalise resource_skills to the client's 4-level proficiency scale:
 *   1 Awareness · 2 Practitioner · 3 Advanced · 4 Expert
 * - Any skill_level > 4 (legacy "thought leader" = 5) is clamped to 4.
 * - proficiency_level string is realigned to match the numeric level.
 * Safe / idempotent.
 *
 * Usage: node scripts/migrations/normalise-skill-levels-4.mjs
 */
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const clamped = await client.query(`UPDATE resource_skills SET skill_level = 4 WHERE skill_level > 4`);
  const relabelled = await client.query(`
    UPDATE resource_skills SET proficiency_level = CASE
      WHEN skill_level IS NULL OR skill_level <= 1 THEN 'awareness'
      WHEN skill_level = 2 THEN 'practitioner'
      WHEN skill_level = 3 THEN 'advanced'
      ELSE 'expert'
    END`);
  console.log(`OK: clamped ${clamped.rowCount} row(s) >4 to 4; realigned ${relabelled.rowCount} proficiency label(s).`);
} finally {
  client.release();
  await pool.end();
}
