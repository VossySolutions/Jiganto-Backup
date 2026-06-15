#!/usr/bin/env node
/**
 * Patch BPM module schema — adds columns and tables for full spec compliance.
 * Run: npm run db:patch-bpm
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  // BPM libraries extended metadata
  `ALTER TABLE bpm_libraries ADD COLUMN IF NOT EXISTS project_id integer`,
  `ALTER TABLE bpm_libraries ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft'`,
  `ALTER TABLE bpm_libraries ADD COLUMN IF NOT EXISTS owner_id varchar`,
  `ALTER TABLE bpm_libraries ADD COLUMN IF NOT EXISTS system_tag text`,
  `ALTER TABLE bpm_libraries ADD COLUMN IF NOT EXISTS is_template_library boolean DEFAULT false`,
  `ALTER TABLE bpm_libraries ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`,

  // BPM templates tier / submission
  `ALTER TABLE bpm_templates ADD COLUMN IF NOT EXISTS tier text DEFAULT 'customer'`,
  `ALTER TABLE bpm_templates ADD COLUMN IF NOT EXISTS submission_status text`,
  `ALTER TABLE bpm_templates ADD COLUMN IF NOT EXISTS submitted_by_org text`,
  `ALTER TABLE bpm_templates ADD COLUMN IF NOT EXISTS review_feedback text`,
  `ALTER TABLE bpm_templates ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`,

  // BPML templates extended
  `ALTER TABLE bpml_templates ADD COLUMN IF NOT EXISTS project_id integer`,
  `ALTER TABLE bpml_templates ADD COLUMN IF NOT EXISTS org_chart_id integer`,
  `ALTER TABLE bpml_templates ADD COLUMN IF NOT EXISTS process_id_prefix text DEFAULT 'P-'`,

  // BPML entries spec fields
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS process_short_name text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS notes text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS business_area text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS business_function text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS process_level text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS system_name text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS module_area text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS transaction_screen text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS as_is_status text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS to_be_status text`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS linked_diagram_id integer`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS test_coverage_summary jsonb`,
  `ALTER TABLE bpml_entries ADD COLUMN IF NOT EXISTS updated_by varchar`,

  // Org chart members extended
  `ALTER TABLE org_chart_members ADD COLUMN IF NOT EXISTS organisation text`,
  `ALTER TABLE org_chart_members ADD COLUMN IF NOT EXISTS engagement_level text`,
  `ALTER TABLE org_chart_members ADD COLUMN IF NOT EXISTS notes text`,

  // New tables
  `CREATE TABLE IF NOT EXISTS process_portal_settings (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL,
    library_id integer,
    access_model text NOT NULL DEFAULT 'open',
    business_area_colors jsonb DEFAULT '{}',
    user_area_tags jsonb DEFAULT '{}',
    custom_asset_types jsonb DEFAULT '[]',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS bpml_entry_history (
    id serial PRIMARY KEY,
    entry_id integer NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    changed_by varchar,
    changed_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS bpm_step_links (
    id serial PRIMARY KEY,
    diagram_id integer NOT NULL,
    node_id text NOT NULL,
    link_type text NOT NULL,
    target_id integer NOT NULL,
    label text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS bpm_template_submissions (
    id serial PRIMARY KEY,
    template_id integer NOT NULL,
    tenant_id integer NOT NULL,
    submitted_by varchar,
    status text NOT NULL DEFAULT 'pending',
    review_feedback text,
    reviewed_by varchar,
    reviewed_at timestamp,
    created_at timestamp DEFAULT now()
  )`,
];

async function main() {
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      try {
        await client.query(sql);
        console.log("OK:", sql.slice(0, 60) + "...");
      } catch (e) {
        console.warn("SKIP:", e.message);
      }
    }
    console.log("BPM schema patch complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
