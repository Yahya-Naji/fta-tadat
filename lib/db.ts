/**
 * SQLite singleton for the TADAT POC.
 *
 * On Vercel the filesystem is read-only outside /tmp, so when running on
 * Vercel we open the DB in read-only mode and skip WAL (which would try
 * to create .db-wal / .db-shm sidecar files). Locally — for `db:init` and
 * `db:seed` — we open read/write with WAL for speed.
 */
import Database from "better-sqlite3";
import { join } from "node:path";

const DB_PATH = process.env.TADAT_DB_PATH ?? join(process.cwd(), "data", "tadat-fta.db");

// Vercel sets VERCEL=1 in every environment (preview + production).
// In Node prod builds elsewhere we still want WAL; we only force read-only
// when the runtime filesystem is read-only (Vercel) or the caller
// explicitly opts in via TADAT_DB_READONLY=1.
const READ_ONLY =
  process.env.VERCEL === "1" || process.env.TADAT_DB_READONLY === "1";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH, READ_ONLY ? { readonly: true, fileMustExist: true } : undefined);
  if (!READ_ONLY) _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
