/**
 * Initialize the TADAT POC database — creates schema fresh.
 * Safe to re-run: drops all tables first.
 */
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const DB_PATH = join(process.cwd(), "data", "tadat-fta.db");
const SCHEMA_PATH = join(process.cwd(), "data", "seed", "schema.sql");

// Fresh start
if (existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`🗑   Removed existing DB at ${DB_PATH}`);
}
const wal = `${DB_PATH}-wal`;
const shm = `${DB_PATH}-shm`;
if (existsSync(wal)) unlinkSync(wal);
if (existsSync(shm)) unlinkSync(shm);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as Array<{ name: string }>;

console.log(`✅  DB initialized at ${DB_PATH}`);
console.log(`    Tables: ${tables.map((t) => t.name).join(", ")}`);

db.close();
