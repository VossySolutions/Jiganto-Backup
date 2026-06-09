/**
 * Apply client workspace RLS policies (scripts/sql/clients-rls.sql).
 *
 * Idempotent — safe to re-run after pulls or when new tables are added.
 * Uses DATABASE_URL (same as npm run dev / db:push).
 *
 * Stop `npm run dev` first if you see pool timeout errors.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";
import { getDatabasePoolConfig } from "../server/lib/database";

const SQL_PATH = "scripts/sql/clients-rls.sql";

/** Tables covered by clients-rls.sql — used for per-table apply + skip missing. */
export const CLIENT_RLS_TABLES = [
  "pm_projects",
  "crm_accounts",
  "documents",
  "document_folders",
  "tasks",
  "notifications",
  "strategy_items",
  "initiatives",
  "governance_items",
] as const;

const FUNCTION_AND_PROCEDURE_SQL = `
CREATE OR REPLACE FUNCTION jiganto_client_scope_allowed(row_client_id integer) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT
      COALESCE(current_setting('app.client_id', true), '') = ''
      OR (
        row_client_id IS NOT NULL
        AND row_client_id = NULLIF(current_setting('app.client_id', true), '')::integer
      );
  $$;

CREATE OR REPLACE PROCEDURE jiganto_apply_client_rls(tbl text) LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_client_scope', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %I USING (jiganto_client_scope_allowed(client_id)) WITH CHECK (jiganto_client_scope_allowed(client_id))',
    tbl || '_client_scope',
    tbl
  );
END;
$$;
`;

async function tableExists(client: pg.PoolClient, table: string): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

async function columnExists(client: pg.PoolClient, table: string, column: string): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }

  const sqlFile = join(process.cwd(), SQL_PATH);
  readFileSync(sqlFile, "utf8"); // ensure file exists; logic kept in sync below

  console.log("Jiganto — apply client workspace RLS");
  console.log(`  Source: ${SQL_PATH}`);
  console.log(`  Database: ${url.replace(/:[^:@/]+@/, ":****@")}\n`);

  const pool = new pg.Pool(getDatabasePoolConfig(url));
  const client = await pool.connect();

  try {
    console.log("→ Creating jiganto_client_scope_allowed + jiganto_apply_client_rls…");
    await client.query(FUNCTION_AND_PROCEDURE_SQL);
    console.log("  ✓ Function and procedure ready\n");

    let applied = 0;
    let skipped = 0;

    for (const table of CLIENT_RLS_TABLES) {
      if (!(await tableExists(client, table))) {
        console.log(`  ⊘ ${table} — table not found (run npm run db:push)`);
        skipped++;
        continue;
      }
      if (!(await columnExists(client, table, "client_id"))) {
        console.log(`  ⊘ ${table} — no client_id column (run related migration SQL)`);
        skipped++;
        continue;
      }
      try {
        await client.query(`CALL jiganto_apply_client_rls($1)`, [table]);
        console.log(`  ✓ ${table}`);
        applied++;
      } catch (err) {
        console.error(`  ✗ ${table}:`, err instanceof Error ? err.message : err);
        throw err;
      }
    }

    console.log(`\n✅ Client RLS applied on ${applied} table(s).`);
    if (skipped > 0) {
      console.log(`   ${skipped} table(s) skipped (missing table or client_id).`);
    }
    console.log("\nPolicies use app.client_id set by server middleware per request.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nFailed to apply client RLS:", err);
  process.exit(1);
});
