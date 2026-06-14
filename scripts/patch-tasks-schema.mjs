import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const statements = [
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id integer`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_personal boolean DEFAULT false`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_ref text`,
  `UPDATE tasks SET status = 'todo' WHERE status IN ('not_started', 'pending')`,
  `UPDATE tasks SET status = 'completed' WHERE status IN ('complete', 'done')`,
  `UPDATE tasks SET status = 'in_progress' WHERE status IN ('delayed', 'at_risk', 'blocked', 'in_review')`,
  `UPDATE tasks SET source = 'personal' WHERE source IN ('company', 'customer', 'email', 'crm', 'initiative')`,
  `UPDATE tasks SET source = 'team' WHERE source = 'team'`,
  `UPDATE tasks SET source = 'project' WHERE source = 'project'`,
  `UPDATE tasks SET is_personal = true WHERE source = 'personal' AND is_personal IS NOT TRUE`,
  `CREATE TABLE IF NOT EXISTS task_comments (
    id serial PRIMARY KEY,
    task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id varchar NOT NULL,
    body text NOT NULL,
    parent_id integer,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS task_time_logs (
    id serial PRIMARY KEY,
    task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id varchar NOT NULL,
    hours numeric(6,2) NOT NULL,
    notes text,
    logged_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS task_attachments (
    id serial PRIMARY KEY,
    task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    mime_type text,
    uploaded_by varchar,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON task_time_logs(task_id)`,
];

try {
  for (const sql of statements) {
    await pool.query(sql);
    console.log("OK:", sql.slice(0, 70));
  }
  console.log("Tasks schema patch applied");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
