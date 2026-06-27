/**
 * Adds document_folders.metadata for folder-level page header/footer defaults.
 * Run: node scripts/patch-document-folder-metadata.mjs
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE document_folders
      ADD COLUMN IF NOT EXISTS metadata jsonb;
    `);
    console.log("OK: document_folders.metadata column ready");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
