#!/usr/bin/env node
/**
 * Whiteboard module schema — Module 19.
 * Run: node scripts/patch-whiteboard-schema.mjs
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  `CREATE TABLE IF NOT EXISTS whiteboards (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES tenants(id),
    workspace_id integer,
    project_id integer,
    name varchar(80) NOT NULL,
    description varchar(300),
    owner_id varchar NOT NULL REFERENCES users(id),
    thumbnail_url text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS whiteboards_tenant_idx ON whiteboards(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS whiteboards_project_idx ON whiteboards(project_id)`,
  `CREATE INDEX IF NOT EXISTS whiteboards_owner_idx ON whiteboards(owner_id)`,

  `CREATE TABLE IF NOT EXISTS whiteboard_members (
    id serial PRIMARY KEY,
    whiteboard_id integer NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
    user_id varchar NOT NULL REFERENCES users(id),
    permission text NOT NULL DEFAULT 'edit',
    invited_by varchar REFERENCES users(id),
    created_at timestamp DEFAULT now(),
    UNIQUE(whiteboard_id, user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS whiteboard_share_tokens (
    id serial PRIMARY KEY,
    whiteboard_id integer NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    permission text NOT NULL DEFAULT 'view',
    allow_anonymous boolean DEFAULT false,
    expires_at timestamp,
    created_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS sticky_notes (
    id serial PRIMARY KEY,
    whiteboard_id integer NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
    text text NOT NULL DEFAULT '',
    note_type text NOT NULL DEFAULT 'idea',
    colour_hex text,
    x_position real NOT NULL DEFAULT 0,
    y_position real NOT NULL DEFAULT 0,
    width integer NOT NULL DEFAULT 200,
    height integer NOT NULL DEFAULT 200,
    created_by varchar REFERENCES users(id),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    is_deleted boolean DEFAULT false
  )`,
  `CREATE INDEX IF NOT EXISTS sticky_notes_board_idx ON sticky_notes(whiteboard_id)`,

  `CREATE TABLE IF NOT EXISTS whiteboard_activity (
    id serial PRIMARY KEY,
    whiteboard_id integer NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    actor_id varchar REFERENCES users(id),
    actor_name text,
    note_id integer,
    detail_json jsonb DEFAULT '{}',
    created_at timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS whiteboard_activity_board_idx ON whiteboard_activity(whiteboard_id)`,
];

async function main() {
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
      console.log("OK:", sql.split("\n")[0].slice(0, 80));
    }
    console.log("Whiteboard schema patch complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
