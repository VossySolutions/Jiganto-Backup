/**
 * Quick DB connectivity + schema spot-check (no migrations).
 * Usage: node scripts/verify-db-schema.mjs
 */
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 20_000,
});

const EXPECTED_TABLES = [
  "crm_accounts",
  "crm_opportunities",
  "crm_pipelines",
  "tasks",
  "finance_invoices",
  "sd_tickets",
  "hd_portal_configs",
];

async function main() {
  console.log("Connecting to database...");
  await client.connect();
  console.log("Connected.\n");

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [EXPECTED_TABLES],
  );
  const found = new Set(rows.map((r) => r.table_name));
  let missing = 0;
  for (const t of EXPECTED_TABLES) {
    if (found.has(t)) console.log(`  ✓ ${t}`);
    else {
      console.log(`  ✗ ${t} (missing)`);
      missing++;
    }
  }

  const { rows: colRows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_opportunities'
     ORDER BY ordinal_position`,
  );
  if (colRows.length) {
    const cols = colRows.map((r) => r.column_name);
    console.log(`\ncrm_opportunities columns (${cols.length}): ${cols.slice(0, 8).join(", ")}${cols.length > 8 ? "…" : ""}`);
  }

  await client.end();
  console.log(missing ? `\n${missing} expected table(s) missing — run npm run db:push` : "\nAll spot-check tables present.");
  process.exit(missing ? 1 : 0);
}

main().catch((err) => {
  console.error("DB check failed:", err.message);
  process.exit(1);
});
