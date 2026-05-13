/**
 * Eval harness — runs each agent's SQL aggregation, applies the TADAT rubric
 * (deterministically, no LLM), and compares to the expected scores in
 * eval/ground-truth.json.
 *
 * Two layers of evaluation are possible:
 *   Layer 1 (this script) — deterministic rubric check on aggregations.
 *                           Confirms the DB seed produces TADAT-band-correct
 *                           numbers.
 *   Layer 2 (manual)      — once the 3 Quanterra teams are deployed and
 *                           AUTOGEN_TADAT_POA*_TEAM_ID env vars are set,
 *                           POST /api/agents/{id}/run for each, parse the
 *                           returned JSON, and compare ind by ind to the
 *                           same ground truth. Layer 2 measures LLM scoring
 *                           accuracy; Layer 1 measures data-pipeline accuracy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateRegistry,
  aggregateFiling,
  aggregatePayments,
} from "../lib/tadat/aggregations";
import {
  scoreHigherBetter,
  scoreLowerBetter,
  worstScore,
  RUBRIC_POA1,
  RUBRIC_POA4,
  RUBRIC_POA5,
} from "../lib/tadat/rubric";

const groundTruth = JSON.parse(
  readFileSync(join(process.cwd(), "eval", "ground-truth.json"), "utf-8")
);

let pass = 0;
let fail = 0;

function check(label: string, expected: unknown, actual: unknown) {
  const ok = expected === actual;
  console.log(`  ${ok ? "✅" : "❌"}  ${label.padEnd(48)}  expected=${expected}  got=${actual}`);
  if (ok) pass++;
  else fail++;
}
function checkRange(label: string, value: number, min: number, max: number) {
  const ok = value >= min && value <= max;
  console.log(
    `  ${ok ? "✅" : "❌"}  ${label.padEnd(48)}  ${value.toFixed(1)} ∈ [${min}, ${max}]`
  );
  if (ok) pass++;
  else fail++;
}

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  Layer 1 Eval — Deterministic Rubric on SQL Aggregations");
console.log("══════════════════════════════════════════════════════════════════\n");

// ── POA 1 ──────────────────────────────────────────────────────────────────
console.log("─── POA 1 · Registry Integrity ──────────────────────────────\n");
const reg = aggregateRegistry();
const total = reg.registry_stats.total_records;
const dupRate = reg.registry_stats.soft_duplicate_pairs_count / total;
const missingContactRate = reg.registry_stats.missing_either_contact_count / total;
const dormantRate = reg.registry_stats.active_with_no_recent_filing_count / total;

const dupScore = scoreLowerBetter(dupRate, RUBRIC_POA1.duplicateRate.thresholds);
const contactScore = scoreLowerBetter(missingContactRate, RUBRIC_POA1.missingContactRate.thresholds);
const dormantScore = scoreLowerBetter(dormantRate, RUBRIC_POA1.dormantMismatchRate.thresholds);
const p11_2 = worstScore([dupScore, contactScore, dormantScore]);

console.log(`    P1-1-2 components:`);
console.log(`      duplicates ${(dupRate * 100).toFixed(2)}% → ${dupScore}`);
console.log(`      missing contact ${(missingContactRate * 100).toFixed(2)}% → ${contactScore}`);
console.log(`      dormant mismatch ${(dormantRate * 100).toFixed(2)}% → ${dormantScore}\n`);
check("P1-1-2 deterministic score", groundTruth.expected.POA1["P1-1-2"], p11_2);

// ── POA 4 ──────────────────────────────────────────────────────────────────
console.log("\n─── POA 4 · On-Time Filing ──────────────────────────────────\n");
const fil = aggregateFiling();

const ctRate = fil.filing_rates.CT.rate_all_pct;
const vatRate = fil.filing_rates.VAT.rate_all_pct;
const exciseRate = fil.filing_rates.EXCISE.rate_all_pct;
const eFiling = fil.e_filing_rate_pct_overall;

checkRange("P4-13-1 CT rate range", ctRate,
  groundTruth.expected.POA4["P4-13-1_CT"].expected_rate_pct_min,
  groundTruth.expected.POA4["P4-13-1_CT"].expected_rate_pct_max);
checkRange("P4-13-3 VAT rate range", vatRate,
  groundTruth.expected.POA4["P4-13-3_VAT"].expected_rate_pct_min,
  groundTruth.expected.POA4["P4-13-3_VAT"].expected_rate_pct_max);
checkRange("P4-13-4 Excise rate range", exciseRate,
  groundTruth.expected.POA4["P4-13-4_EXCISE"].expected_rate_pct_min,
  groundTruth.expected.POA4["P4-13-4_EXCISE"].expected_rate_pct_max);
checkRange("P4-15 e-filing rate range", eFiling,
  groundTruth.expected.POA4["P4-15"].expected_rate_pct_min,
  groundTruth.expected.POA4["P4-15"].expected_rate_pct_max);

check("P4-13-1 CT score", groundTruth.expected.POA4["P4-13-1_CT"].expected_score,
  scoreHigherBetter(ctRate, RUBRIC_POA4.onTimeAll.thresholds));
check("P4-13-3 VAT score", groundTruth.expected.POA4["P4-13-3_VAT"].expected_score,
  scoreHigherBetter(vatRate, RUBRIC_POA4.onTimeAll.thresholds));
check("P4-13-4 Excise score", groundTruth.expected.POA4["P4-13-4_EXCISE"].expected_score,
  scoreHigherBetter(exciseRate, RUBRIC_POA4.onTimeAll.thresholds));
check("P4-15 e-filing score", groundTruth.expected.POA4["P4-15"].expected_score,
  scoreHigherBetter(eFiling, RUBRIC_POA4.eFiling.thresholds));

// ── POA 5 ──────────────────────────────────────────────────────────────────
console.log("\n─── POA 5 · Payments & Arrears ──────────────────────────────\n");
const pay = aggregatePayments();

const eP = pay.p5_16_e_payment.by_value_pct_overall;
const p18n = pay.p5_18.vat_on_time_by_number_pct;
const p18v = pay.p5_18.vat_on_time_by_value_pct;
const p19a = pay.p5_19_3yr_avg.total_arrears_to_collections_pct;
const p19b = pay.p5_19_3yr_avg.collectible_arrears_to_collections_pct;
const p19c = pay.p5_19_3yr_avg.over_12mo_to_total_arrears_pct;

checkRange("P5-16 e-payment range", eP,
  groundTruth.expected.POA5["P5-16"].expected_rate_pct_min,
  groundTruth.expected.POA5["P5-16"].expected_rate_pct_max);
checkRange("P5-18-1 VAT pay # range", p18n,
  groundTruth.expected.POA5["P5-18-1_VAT_n"].expected_rate_pct_min,
  groundTruth.expected.POA5["P5-18-1_VAT_n"].expected_rate_pct_max);
checkRange("P5-18-2 VAT pay AED range", p18v,
  groundTruth.expected.POA5["P5-18-2_VAT_v"].expected_rate_pct_min,
  groundTruth.expected.POA5["P5-18-2_VAT_v"].expected_rate_pct_max);
checkRange("P5-19-1 total arrears ratio range", p19a,
  groundTruth.expected.POA5["P5-19-1"].expected_ratio_pct_min,
  groundTruth.expected.POA5["P5-19-1"].expected_ratio_pct_max);
checkRange("P5-19-2 collectible ratio range", p19b,
  groundTruth.expected.POA5["P5-19-2"].expected_ratio_pct_min,
  groundTruth.expected.POA5["P5-19-2"].expected_ratio_pct_max);
checkRange("P5-19-3 >12mo ratio range", p19c,
  groundTruth.expected.POA5["P5-19-3"].expected_ratio_pct_min,
  groundTruth.expected.POA5["P5-19-3"].expected_ratio_pct_max);

check("P5-16 score", groundTruth.expected.POA5["P5-16"].expected_score,
  scoreHigherBetter(eP, RUBRIC_POA5.ePaymentAll.thresholds));
check("P5-18-1 score", groundTruth.expected.POA5["P5-18-1_VAT_n"].expected_score,
  scoreHigherBetter(p18n, RUBRIC_POA5.onTimePay.thresholds));
check("P5-18-2 score", groundTruth.expected.POA5["P5-18-2_VAT_v"].expected_score,
  scoreHigherBetter(p18v, RUBRIC_POA5.onTimePay.thresholds));
check("P5-19-1 score", groundTruth.expected.POA5["P5-19-1"].expected_score,
  scoreLowerBetter(p19a, RUBRIC_POA5.totalArrearsRatio.thresholds));
check("P5-19-2 score", groundTruth.expected.POA5["P5-19-2"].expected_score,
  scoreLowerBetter(p19b, RUBRIC_POA5.collectibleArrearsRatio.thresholds));
check("P5-19-3 score", groundTruth.expected.POA5["P5-19-3"].expected_score,
  scoreLowerBetter(p19c, RUBRIC_POA5.oldArrearsRatio.thresholds));

console.log("\n══════════════════════════════════════════════════════════════════");
console.log(`  Result: ${pass} passed, ${fail} failed`);
console.log("══════════════════════════════════════════════════════════════════\n");

process.exit(fail > 0 ? 1 : 0);
