/**
 * Postgres connection pool — Supabase host in prod, any Postgres locally.
 *
 * Routes/scripts get a singleton `pg.Pool` via getDb(). Queries are async:
 *
 *   const db = getDb();
 *   const r  = await db.query(`SELECT 1`);          // r.rows : any[]
 *   const r2 = await db.query(`SELECT * FROM t WHERE x = $1`, [42]);
 *
 * Connection string lives in env (DATABASE_URL). For Supabase we use the
 * Transaction Pooler (port 6543) which is the right mode for serverless.
 *
 * `pool.end()` is only used by one-shot CLI scripts (seed/verify); never
 * by long-lived Next.js processes — letting the pool live for the worker
 * lifetime is correct.
 */
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

let _pool: Pool | null = null;

export function getDb(): Pool {
  if (_pool) return _pool;
  // Read at call time, not module-load time — CLI scripts call dotenv.config()
  // AFTER imports, so module-time reads see undefined.
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local and to Vercel project settings.",
    );
  }
  _pool = new Pool({
    connectionString: conn,
    // Supabase requires SSL; node-postgres needs it explicit
    ssl: needsSsl(conn) ? { rejectUnauthorized: false } : false,
    max: 8,           // keep modest — Vercel functions are short-lived
    idleTimeoutMillis: 10_000,
  });
  return _pool;
}

/** Close the pool — used by CLI scripts after seed/verify completes. */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * One-row helper. Mirrors the SQLite `prepare(sql).get(...)` ergonomic.
 * Returns the first row or undefined.
 */
export async function one<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const r: QueryResult<T> = await getDb().query<T>(sql, params as never);
  return r.rows[0];
}

/**
 * Multi-row helper. Mirrors `prepare(sql).all(...)`.
 */
export async function many<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r: QueryResult<T> = await getDb().query<T>(sql, params as never);
  return r.rows;
}

/**
 * Write helper. Mirrors `prepare(sql).run(...)`.
 * Returns `rowCount` for callers that care.
 */
export async function exec(sql: string, params: unknown[] = []): Promise<number> {
  const r = await getDb().query(sql, params as never);
  return r.rowCount ?? 0;
}

/**
 * Run callbacks inside a single client (useful for batched seed inserts).
 */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDb().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

function needsSsl(conn: string): boolean {
  // Supabase pooler always requires SSL. Local Postgres typically does not.
  return (
    conn.includes("supabase.com") ||
    conn.includes("supabase.co") ||
    /sslmode=require/i.test(conn)
  );
}
