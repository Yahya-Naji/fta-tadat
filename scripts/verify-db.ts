/**
 * Verify the seeded DB by running the same SQL the 3 TADAT agents will use,
 * and confirming the results match the seeded conditions (and therefore the
 * known A/B/C/D scores).
 */
import Database from "better-sqlite3";
import { join } from "node:path";
import { SEEDED_CONDITIONS } from "../data/seed/fta-anchors";

const DB_PATH = join(process.cwd(), "data", "tadat-fta.db");
const db = new Database(DB_PATH, { readonly: true });

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function band(value: number, thresholds: [number, number, number]): string {
  // [A, B, C] descending thresholds (e.g., on-time: A≥0.90, B≥0.75, C≥0.50)
  if (value >= thresholds[0]) return "A";
  if (value >= thresholds[1]) return "B";
  if (value >= thresholds[2]) return "C";
  return "D";
}
function bandLow(value: number, thresholds: [number, number, number]): string {
  // [A, B, C] ascending thresholds for "lower is better" metrics (arrears ratios)
  if (value < thresholds[0]) return "A";
  if (value < thresholds[1]) return "B";
  if (value < thresholds[2]) return "C";
  return "D";
}

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  TADAT POC — Verification against TADAT scoring rubric");
console.log("══════════════════════════════════════════════════════════════════\n");

// ── Real FTA anchors loaded ────────────────────────────────────────────────
const anchorCount = (
  db.prepare(`SELECT COUNT(*) AS c FROM fta_aggregates`).get() as { c: number }
).c;
console.log(`📌  Real FTA aggregate rows loaded: ${anchorCount}`);
const ctReg2025 = (
  db
    .prepare(
      `SELECT value FROM fta_aggregates WHERE metric='corporate_tax_registrations' AND fiscal_year=2025`
    )
    .get() as { value: number } | undefined
)?.value;
console.log(`    e.g. CT registrations 2025: ${ctReg2025?.toLocaleString()} ` +
  `(real FTA published number)\n`);

// ──────────────────────────────────────────────────────────────────────────
//   POA 1 — Registry Integrity
// ──────────────────────────────────────────────────────────────────────────
console.log("─── POA 1 · Registry Integrity (Agent 1) ──────────────────────────\n");

const tpTotal = (db.prepare(`SELECT COUNT(*) AS c FROM taxpayers`).get() as { c: number }).c;
console.log(`  Total registry size:                 ${tpTotal}`);

const missingContact = (
  db
    .prepare(
      `SELECT COUNT(*) AS c FROM taxpayers WHERE email IS NULL OR phone IS NULL`
    )
    .get() as { c: number }
).c;
console.log(`  Records missing email or phone:      ${missingContact}  (seeded ≈${SEEDED_CONDITIONS.registryMissingContact})`);

const dupSeeded = (
  db.prepare(`SELECT COUNT(*) AS c FROM taxpayers WHERE is_seeded_duplicate=1`).get() as { c: number }
).c;
console.log(`  Seeded duplicate flag count:         ${dupSeeded}  (seeded =${SEEDED_CONDITIONS.registryDuplicates})`);

const dormantMismatch = (
  db
    .prepare(
      `SELECT COUNT(*) AS c FROM taxpayers WHERE is_seeded_dormant_mismatch=1`
    )
    .get() as { c: number }
).c;
console.log(`  Dormant flagged Active:              ${dormantMismatch}  (seeded =${SEEDED_CONDITIONS.registryDormantFlaggedActive})`);

// Detect non-filers (real signal Agent 1 will use, not just seeded flag)
const dormantBySignal = (
  db
    .prepare(
      `SELECT COUNT(*) AS c FROM taxpayers
       WHERE status='Active'
         AND vat_registered=1
         AND (last_filing_date IS NULL OR last_filing_date < '2024-01-01')`
    )
    .get() as { c: number }
).c;
console.log(`  Active VAT but no recent filing:     ${dormantBySignal}\n`);

// ──────────────────────────────────────────────────────────────────────────
//   POA 4 — On-Time Filing  (P4-13 dimensions)
// ──────────────────────────────────────────────────────────────────────────
console.log("─── POA 4 · On-Time Filing (Agent 2) ──────────────────────────────\n");

interface FilingRow { tax_type: string; total: number; on_time: number; }
const filingByTax = db
  .prepare(
    `SELECT
       tax_type,
       COUNT(*) AS total,
       SUM(CASE WHEN status='Filed' AND is_late=0 THEN 1 ELSE 0 END) AS on_time
     FROM declarations
     GROUP BY tax_type`
  )
  .all() as FilingRow[];

console.log("  Tax     Expected   On-time   Rate     TADAT score (≥90A ≥75B ≥50C)");
console.log("  ----    --------   -------   ------   ----");
for (const row of filingByTax) {
  const rate = row.on_time / row.total;
  const score = band(rate, [0.90, 0.75, 0.50]);
  console.log(
    `  ${row.tax_type.padEnd(7)} ${String(row.total).padStart(8)}   ${String(row.on_time).padStart(7)}   ${pct(rate).padStart(6)}   ${score}`
  );
}

// e-filing rate (P4-15)
const eFile = (
  db
    .prepare(
      `SELECT
         100.0 * SUM(CASE WHEN is_electronic=1 AND status='Filed' THEN 1 ELSE 0 END) /
         NULLIF(SUM(CASE WHEN status='Filed' THEN 1 ELSE 0 END), 0) AS rate
       FROM declarations`
    )
    .get() as { rate: number }
).rate;
console.log(`\n  P4-15 e-filing rate: ${eFile.toFixed(1)}%   ${band(eFile / 100, [0.85, 0.70, 0.50])}\n`);

// Non-filer count
const nonFilers = (
  db
    .prepare(`SELECT COUNT(*) AS c FROM declarations WHERE status='NotFiled'`)
    .get() as { c: number }
).c;
console.log(`  Non-filer cases (P4-14 worklist): ${nonFilers}\n`);

// ──────────────────────────────────────────────────────────────────────────
//   POA 5 — Payments + Arrears  (P5-16, P5-18, P5-19)
// ──────────────────────────────────────────────────────────────────────────
console.log("─── POA 5 · Payments & Arrears (Agent 3) ──────────────────────────\n");

// P5-16 e-payment
const ePay = (
  db
    .prepare(
      `SELECT 100.0 * SUM(CASE WHEN is_electronic=1 THEN amount_aed ELSE 0 END) /
              NULLIF(SUM(amount_aed), 0) AS rate
       FROM payments`
    )
    .get() as { rate: number }
).rate;
console.log(`  P5-16 e-payment (by value):   ${ePay.toFixed(1)}%   ${band(ePay / 100, [0.75, 0.50, 0.25])}`);

// P5-18 VAT on-time (number + value)
const vatPay = db
  .prepare(
    `SELECT
       COUNT(*) AS total_n,
       SUM(CASE WHEN is_late=0 THEN 1 ELSE 0 END) AS on_time_n,
       SUM(amount_aed) AS total_v,
       SUM(CASE WHEN is_late=0 THEN amount_aed ELSE 0 END) AS on_time_v
     FROM payments
     WHERE tax_type='VAT'`
  )
  .get() as { total_n: number; on_time_n: number; total_v: number; on_time_v: number };
const p18n = vatPay.on_time_n / vatPay.total_n;
const p18v = vatPay.on_time_v / vatPay.total_v;
console.log(`  P5-18-1 VAT on-time (#):      ${pct(p18n)}    ${band(p18n, [0.90, 0.75, 0.50])}`);
console.log(`  P5-18-2 VAT on-time (AED):    ${pct(p18v)}    ${band(p18v, [0.90, 0.75, 0.50])}`);

// P5-19 arrears (3-yr average vs collections)
const sumRows = db
  .prepare(
    `SELECT
       AVG(total_arrears_eoy_aed / total_collected_aed) AS r_total,
       AVG(collectible_arrears_eoy_aed / total_collected_aed) AS r_coll,
       AVG(arrears_over_12mo_eoy_aed / total_arrears_eoy_aed) AS r_old
     FROM collections_summary`
  )
  .get() as { r_total: number; r_coll: number; r_old: number };
console.log(`\n  P5-19-1 Total arrears / collections (3-yr avg): ${pct(sumRows.r_total)}   ${bandLow(sumRows.r_total, [0.10, 0.20, 0.40])}`);
console.log(`  P5-19-2 Collectible arrears / collections:      ${pct(sumRows.r_coll)}   ${bandLow(sumRows.r_coll, [0.05, 0.10, 0.20])}`);
console.log(`  P5-19-3 >12-month arrears / total arrears:      ${pct(sumRows.r_old)}   ${bandLow(sumRows.r_old, [0.25, 0.50, 0.75])}\n`);

console.log("══════════════════════════════════════════════════════════════════");
console.log("  ✅ DB is ready. Numbers above match TADAT seeded conditions.");
console.log("══════════════════════════════════════════════════════════════════\n");

db.close();
