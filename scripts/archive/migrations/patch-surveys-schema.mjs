#!/usr/bin/env node
/**
 * Patch Surveys module schema — Module 17 full spec compliance.
 * Run: node scripts/patch-surveys-schema.mjs
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  // surveys extended columns
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS workspace_id integer`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS survey_type text`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS allow_multiple_responses boolean DEFAULT false`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS show_results_to_respondents boolean DEFAULT false`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS allow_external boolean DEFAULT true`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS close_date timestamp`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS reminder_at timestamp`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS invited_count integer DEFAULT 0`,
  `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS archived_at timestamp`,

  // survey_questions extended
  `ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS rating_display text DEFAULT 'numbers'`,
  `ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS max_length integer`,
  `ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS is_section boolean DEFAULT false`,
  `ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS logic_json jsonb DEFAULT '[]'`,

  // survey_responses extended
  `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS respondent_user_id varchar`,
  `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS session_token text`,
  `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS is_complete boolean DEFAULT false`,

  // survey_answers extended
  `ALTER TABLE survey_answers ADD COLUMN IF NOT EXISTS file_url text`,

  // survey_distributions
  `CREATE TABLE IF NOT EXISTS survey_distributions (
    id serial PRIMARY KEY,
    survey_id integer NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    distribution_type text NOT NULL,
    target_user_ids jsonb DEFAULT '[]',
    target_emails jsonb DEFAULT '[]',
    sent_at timestamp DEFAULT now(),
    reminder_at timestamp,
    reminder_sent_at timestamp,
    created_by varchar,
    created_at timestamp DEFAULT now()
  )`,

  // survey_templates
  `CREATE TABLE IF NOT EXISTS survey_templates (
    id serial PRIMARY KEY,
    tenant_id integer REFERENCES tenants(id),
    title text NOT NULL,
    description text,
    survey_type text,
    category text,
    tier text NOT NULL DEFAULT 'customer',
    submission_status text,
    contributed_by_org text,
    questions_json jsonb DEFAULT '[]',
    settings_json jsonb DEFAULT '{}',
    created_by varchar,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,

  // module_polls
  `CREATE TABLE IF NOT EXISTS module_polls (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES tenants(id),
    workspace_id integer,
    project_id integer,
    chat_channel_id integer,
    chat_poll_id integer,
    question text NOT NULL,
    options jsonb NOT NULL,
    poll_type text NOT NULL DEFAULT 'single',
    anonymous boolean DEFAULT false,
    show_results_to_voters boolean DEFAULT true,
    allow_vote_change boolean DEFAULT false,
    status text NOT NULL DEFAULT 'active',
    close_at timestamp,
    token text UNIQUE,
    created_by varchar,
    created_by_name text,
    created_at timestamp DEFAULT now()
  )`,
  `ALTER TABLE module_polls ADD COLUMN IF NOT EXISTS chat_poll_id integer`,

  // module_poll_votes
  `CREATE TABLE IF NOT EXISTS module_poll_votes (
    id serial PRIMARY KEY,
    poll_id integer NOT NULL REFERENCES module_polls(id) ON DELETE CASCADE,
    voter_id varchar,
    voter_name text,
    option_indexes jsonb NOT NULL DEFAULT '[]',
    voted_at timestamp DEFAULT now(),
    UNIQUE(poll_id, voter_id)
  )`,
];

async function main() {
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
      console.log("OK:", sql.slice(0, 70).replace(/\s+/g, " ") + "…");
    }
    console.log("\nSurveys schema patch complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
