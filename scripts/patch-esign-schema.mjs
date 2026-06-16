#!/usr/bin/env node
/**
 * Patch eSign / signoff module schema — Module 18 full spec compliance.
 * Run: node scripts/patch-esign-schema.mjs
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  // signoff_requests extended
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS workspace_id integer`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS project_id integer`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS deliverable_id integer`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS crm_contract_id integer`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS timesheet_period_id integer`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS test_cycle_id integer`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS signature_level text DEFAULT 'ses'`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS description text`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS template_id integer`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS content_html text`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS signing_order text DEFAULT 'sequential'`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS allow_decline boolean DEFAULT true`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS send_copy_on_completion boolean DEFAULT true`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS require_acknowledgement boolean DEFAULT false`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS acknowledgement_text text`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS require_read_to_bottom boolean DEFAULT false`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS signed_pdf_data text`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS void_reason text`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS voided_at timestamp`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS expired_at timestamp`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp`,

  // signoff_signers extended
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS role_title text`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS signing_deadline text`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS private_message text`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS signature_method text`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS signature_data text`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS added_by varchar`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS notified_at timestamp`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS token_used_at timestamp`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS user_agent text`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS otp_verified_at timestamp`,
  `ALTER TABLE signoff_signers ADD COLUMN IF NOT EXISTS eidas_consent_at timestamp`,

  // Phase 2 — OTP + eIDAS + field placement
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS require_otp_verification boolean DEFAULT false`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS require_eidas_consent boolean DEFAULT false`,
  `ALTER TABLE signoff_requests ADD COLUMN IF NOT EXISTS eidas_consent_text text`,

  `CREATE TABLE IF NOT EXISTS esign_signature_fields (
    id serial PRIMARY KEY,
    request_id integer NOT NULL REFERENCES signoff_requests(id) ON DELETE CASCADE,
    signer_email text NOT NULL,
    field_type text NOT NULL,
    page_number integer NOT NULL DEFAULT 1,
    x_percent text NOT NULL DEFAULT '10',
    y_percent text NOT NULL DEFAULT '80',
    width_percent text NOT NULL DEFAULT '25',
    height_percent text NOT NULL DEFAULT '8',
    is_required boolean DEFAULT true,
    label text,
    completed_at timestamp,
    value text,
    created_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS signoff_otp_codes (
    id serial PRIMARY KEY,
    signer_id integer NOT NULL REFERENCES signoff_signers(id) ON DELETE CASCADE,
    code text NOT NULL,
    expires_at timestamp NOT NULL,
    used_at timestamp,
    created_at timestamp DEFAULT now()
  )`,

  // signoff_audit_log extended
  `ALTER TABLE signoff_audit_log ADD COLUMN IF NOT EXISTS signer_id integer`,
  `ALTER TABLE signoff_audit_log ADD COLUMN IF NOT EXISTS user_agent text`,

  // signoff_templates
  `CREATE TABLE IF NOT EXISTS signoff_templates (
    id serial PRIMARY KEY,
    tenant_id integer REFERENCES tenants(id),
    title text NOT NULL,
    description text,
    category text,
    tier text NOT NULL DEFAULT 'customer',
    source_type text NOT NULL DEFAULT 'inline_doc',
    content_html text,
    file_name text,
    file_type text,
    file_data text,
    created_by varchar,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,
];

async function main() {
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
      console.log("OK:", sql.slice(0, 80).replace(/\s+/g, " "));
    }
    console.log("\n✓ eSign schema patch complete");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
