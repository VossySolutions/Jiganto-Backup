/**
 * Patch workspace share token columns.
 * Usage: npm run db:patch-workspaces-share
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "sql", "workspaces-share-tokens.sql"), "utf8");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log("✓ Workspace share token columns applied");
} finally {
  await client.end();
}
