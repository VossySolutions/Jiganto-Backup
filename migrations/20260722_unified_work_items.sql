-- Monday-style unified work items: extend pm_tasks
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS rag_status text DEFAULT 'green';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS phase_number integer;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS methodology text;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS legacy_source text;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS legacy_source_id integer;

CREATE INDEX IF NOT EXISTS pm_tasks_project_gantt_type_idx ON pm_tasks (project_id, gantt_type);
CREATE INDEX IF NOT EXISTS pm_tasks_legacy_source_idx ON pm_tasks (project_id, legacy_source, legacy_source_id);
