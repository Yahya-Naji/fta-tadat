/**
 * Initialize the TADAT POC database (Supabase Postgres host).
 *
 *   1. Load `.env.local` so DATABASE_URL is available
 *   2. Run data/seed/schema.sql against it (drops + recreates tables)
 *   3. Print the resulting table list
 *
 * Safe to re-run: schema.sql opens with `DROP TABLE IF EXISTS ... CASCADE`
 * for every table.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { getDb, closeDb } from "../lib/db";

config({ path: ".env.local" });

const SCHEMA_PATH = join(process.cwd(), "data", "seed", "schema.sql");

async function main() {
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  const db = getDb();

  await db.query(schema);

  const tables = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`,
  );

  console.log(`✅  Schema applied to Supabase Postgres`);
  console.log(`    Tables: ${tables.rows.map((t) => t.table_name).join(", ")}`);

  await closeDb();
}

main().catch((e) => {
  console.error(`❌  init-db failed:`, e);
  process.exit(1);
});
