require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS crm_attachments (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL,
      entity_type text NOT NULL,
      entity_id integer NOT NULL,
      file_name text NOT NULL,
      file_type text,
      file_size integer,
      file_url text,
      uploaded_by_user_id varchar,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  console.log("crm_attachments ready");
  await client.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
