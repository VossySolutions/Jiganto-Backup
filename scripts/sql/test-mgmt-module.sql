-- Test Management Module 15 — schema extensions
-- Run against Postgres (Supabase). Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- Projects
ALTER TABLE tm_projects ADD COLUMN IF NOT EXISTS methodology text DEFAULT 'waterfall';
ALTER TABLE tm_projects ADD COLUMN IF NOT EXISTS active_cycle_id integer;

-- Business Areas / Epics
CREATE TABLE IF NOT EXISTS tm_business_areas (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  project_id integer,
  name text NOT NULL,
  description text,
  owner_id varchar,
  sign_off_status text DEFAULT 'not_signed_off',
  sign_off_by varchar,
  sign_off_at timestamp,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Business Processes / Features
CREATE TABLE IF NOT EXISTS tm_business_processes (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  project_id integer,
  business_area_id integer NOT NULL REFERENCES tm_business_areas(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_id varchar,
  priority text DEFAULT 'medium',
  sign_off_status text DEFAULT 'not_signed_off',
  sign_off_by varchar,
  sign_off_at timestamp,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Scenarios
ALTER TABLE tm_scenarios ADD COLUMN IF NOT EXISTS business_process_id integer REFERENCES tm_business_processes(id) ON DELETE SET NULL;
ALTER TABLE tm_scenarios ADD COLUMN IF NOT EXISTS test_data_notes text;
ALTER TABLE tm_scenarios ADD COLUMN IF NOT EXISTS linked_document_id integer;
ALTER TABLE tm_scenarios ADD COLUMN IF NOT EXISTS sign_off_status text DEFAULT 'not_signed_off';
ALTER TABLE tm_scenarios ADD COLUMN IF NOT EXISTS sign_off_by varchar;
ALTER TABLE tm_scenarios ADD COLUMN IF NOT EXISTS sign_off_at timestamp;

-- Test Cases
ALTER TABLE tm_test_cases ADD COLUMN IF NOT EXISTS scenario_id integer REFERENCES tm_scenarios(id) ON DELETE SET NULL;
ALTER TABLE tm_test_cases ADD COLUMN IF NOT EXISTS test_data text;
ALTER TABLE tm_test_cases ADD COLUMN IF NOT EXISTS test_type text DEFAULT 'functional';
ALTER TABLE tm_test_cases ADD COLUMN IF NOT EXISTS created_by varchar;
ALTER TABLE tm_test_cases ADD COLUMN IF NOT EXISTS linked_acceptance_criterion_id integer;

-- Test Cycles (tm_test_runs)
ALTER TABLE tm_test_runs ADD COLUMN IF NOT EXISTS test_phase text DEFAULT 'uat';
ALTER TABLE tm_test_runs ADD COLUMN IF NOT EXISTS methodology text DEFAULT 'waterfall';
ALTER TABLE tm_test_runs ADD COLUMN IF NOT EXISTS test_manager_id varchar;
ALTER TABLE tm_test_runs ADD COLUMN IF NOT EXISTS build_version text;
ALTER TABLE tm_test_runs ADD COLUMN IF NOT EXISTS notes text;

-- Executions (tm_test_results)
ALTER TABLE tm_test_results ADD COLUMN IF NOT EXISTS actual_result text;
ALTER TABLE tm_test_results ADD COLUMN IF NOT EXISTS blocked_reason text;
ALTER TABLE tm_test_results ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE tm_test_results ADD COLUMN IF NOT EXISTS evidence jsonb DEFAULT '[]';
ALTER TABLE tm_test_results ADD COLUMN IF NOT EXISTS defect_ref_id integer;
ALTER TABLE tm_test_results ADD COLUMN IF NOT EXISTS retest_of_id integer;

-- Sign-offs
CREATE TABLE IF NOT EXISTS tm_sign_offs (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  project_id integer,
  entity_type text NOT NULL,
  entity_id integer NOT NULL,
  test_cycle_id integer,
  signed_off_by varchar NOT NULL,
  signed_off_at timestamp DEFAULT now(),
  pass_rate_at_sign_off real,
  notes text,
  is_conditional boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Defects bridge
ALTER TABLE tm_defects ADD COLUMN IF NOT EXISTS help_desk_ticket_id integer;

-- Status migration for legacy data
UPDATE tm_test_runs SET status = 'planning' WHERE status = 'planned';
UPDATE tm_test_runs SET status = 'abandoned' WHERE status = 'aborted';
UPDATE tm_test_results SET status = 'not_started' WHERE status = 'not_run';
UPDATE tm_test_results SET status = 'pass' WHERE status = 'pass';
UPDATE tm_test_results SET status = 'deferred' WHERE status = 'skipped';

CREATE INDEX IF NOT EXISTS idx_tm_business_areas_project ON tm_business_areas(project_id);
CREATE INDEX IF NOT EXISTS idx_tm_business_processes_area ON tm_business_processes(business_area_id);
CREATE INDEX IF NOT EXISTS idx_tm_scenarios_process ON tm_scenarios(business_process_id);
CREATE INDEX IF NOT EXISTS idx_tm_test_cases_scenario ON tm_test_cases(scenario_id);
CREATE INDEX IF NOT EXISTS idx_tm_sign_offs_entity ON tm_sign_offs(entity_type, entity_id);
