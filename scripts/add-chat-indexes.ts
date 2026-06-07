import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const indexes = [
    `CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx
       ON chat_messages (channel_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS chat_messages_channel_parent_idx
       ON chat_messages (channel_id, parent_id, created_at)`,
  ];

  for (const stmt of indexes) {
    const name = stmt.match(/INDEX IF NOT EXISTS (\S+)/)?.[1] ?? stmt.slice(0, 50);
    console.log("Creating:", name);
    await db.execute(sql.raw(stmt));
    console.log("  ✓ Done");
  }

  console.log("All chat indexes created successfully.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
