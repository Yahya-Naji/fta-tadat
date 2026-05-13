/**
 * Seed the TADAT POC database with calibrated synthetic data (Supabase Postgres).
 *
 * What this does:
 *   1. Inserts real FTA anchor numbers into `fta_aggregates`.
 *   2. Generates 1,000 representative taxpayers (UAE FTA distribution).
 *   3. Generates 12 months of VAT/Excise declarations + Corporate Tax annual.
 *   4. Generates payments calibrated to TADAT seeded conditions.
 *   5. Generates arrears with realistic aging.
 *   6. Injects registry quality issues for Agent 1.
 *   7. Computes collections_summary rollups for 3 fiscal years.
 *
 * Reproducibility: uses a seeded RNG. Same seed → identical DB.
 *
 * Postgres-specific: we batch INSERTs into multi-row statements (~500 rows
 * per call) for throughput over a remote pooler connection. A single
 * transaction wraps the whole seed.
 */
import { config } from "dotenv";
import {
  FTA_ANNUAL,
  EMIRATE_DISTRIBUTION,
  INDUSTRY_DISTRIBUTION,
  SEGMENT_DISTRIBUTION,
  SEEDED_CONDITIONS,
  POC_SAMPLE,
  STATUTORY_DUE_DAYS,
} from "../data/seed/fta-anchors";
import {
  makeRng,
  pickWeighted,
  pick,
  chance,
  randInt,
} from "../data/seed/random";
import {
  ENGLISH_PREFIXES,
  ENGLISH_CORE,
  ENGLISH_SUFFIXES,
  ENTITY_FORMS,
  ARABIC_FRAGMENTS,
  FREE_ZONES,
} from "../data/seed/uae-names";
import { getDb, closeDb, withClient } from "../lib/db";
import type { PoolClient } from "pg";

config({ path: ".env.local" });

const RNG_SEED = 20260505;
const rng = makeRng(RNG_SEED);

const FY = 2025; // primary fiscal year for the POC
const FTA_OPEN_DATA_URL = "https://tax.gov.ae/en/open.data/open.data.aspx";

// ── Helpers ────────────────────────────────────────────────────────────────

function endOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}
function nthOfMonthAfter(year: number, month: number, day: number): string {
  const target = new Date(Date.UTC(year, month, day));
  return target.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateTRN(seq: number): string {
  const middle = String(seq).padStart(8, "0") + String(randInt(rng, 0, 9));
  return `100${middle.padStart(9, "0")}00003`.slice(0, 15);
}
function genEnglishName(): string {
  const prefix = pick(rng, ENGLISH_PREFIXES);
  const core = pick(rng, ENGLISH_CORE);
  const suffix = pick(rng, ENGLISH_SUFFIXES);
  const form = pick(rng, ENTITY_FORMS);
  return `${prefix} ${core} ${suffix} ${form}`;
}
function genArabicName(): string {
  const a = pick(rng, ARABIC_FRAGMENTS);
  const b = pick(rng, ARABIC_FRAGMENTS);
  return `شركة ${a} ${b} ذ.م.م`;
}
function emiratePrefix(emirate: string): string {
  const map: Record<string, string> = {
    Dubai: "+9714",
    "Abu Dhabi": "+9712",
    Sharjah: "+9716",
    Ajman: "+9716",
    "Ras Al Khaimah": "+9717",
    Fujairah: "+9719",
    "Umm Al Quwain": "+9716",
    "Other than Emirates": "+971",
  };
  return map[emirate] ?? "+971";
}

/**
 * Insert `rows` into `table` in batches. Postgres has a placeholder limit
 * (~32k per statement) so we chunk on the row side based on column count.
 */
async function batchInsert(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
  chunkSize = 500,
): Promise<void> {
  if (rows.length === 0) return;
  const colsSql = columns.join(", ");
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk
      .map((row) => {
        const ph = row
          .map((v, j) => {
            values.push(v);
            return `$${values.length}`;
            // (unused) j
            j;
          })
          .join(", ");
        return `(${ph})`;
      })
      .join(", ");
    await client.query(
      `INSERT INTO ${table} (${colsSql}) VALUES ${placeholders}`,
      values,
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("⏳  Connecting to Supabase Postgres …");
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await seed(client);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
  await closeDb();
  console.log("\n🎉  Seed complete.");
}

async function seed(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. fta_aggregates
  // ─────────────────────────────────────────────────────────────────────────
  console.log("⏳  Inserting real FTA anchor numbers …");
  const aggregateRows: unknown[][] = [];
  for (const yr of FTA_ANNUAL) {
    const push = (metric: string, value: number, source: string, notes: string) =>
      aggregateRows.push([yr.year, metric, value, source, FTA_OPEN_DATA_URL, notes]);
    if (yr.vatRegistrations !== undefined)
      push("vat_registrations", yr.vatRegistrations, "Selected Services Results.xlsx", "VAT registrations approved");
    if (yr.vatDeregistrations !== undefined)
      push("vat_deregistrations", yr.vatDeregistrations, "Selected Services Results.xlsx", "VAT deregistrations");
    if (yr.exciseRegistrations !== undefined)
      push("excise_registrations", yr.exciseRegistrations, "Excise Registerations.xlsx", "Excise tax registrations approved");
    if (yr.corporateTaxRegistrations !== undefined)
      push("corporate_tax_registrations", yr.corporateTaxRegistrations, "Open data 2025 full year - final.xlsx", "Corporate Tax registrations");
    if (yr.reconsiderations !== undefined)
      push("reconsiderations", yr.reconsiderations, "Reconsideration Request approved by the FTA.xlsx", "Reconsideration disputes approved");
    if (yr.inquiries !== undefined)
      push("inquiries", yr.inquiries, "No. of Inquiry Request submitted in the year of 2023 - 2024.xlsx", "Inquiry requests");
    if (yr.complaints !== undefined)
      push("complaints", yr.complaints, "Submit Complaints-META.xlsx", "Complaints submitted");
    if (yr.cumulativeVatRegistrants !== undefined)
      push("cumulative_vat_registrants", yr.cumulativeVatRegistrants, "Approved VAT registeration.xlsx", "Running total approved VAT registrants");
  }
  await batchInsert(
    client,
    "fta_aggregates",
    ["fiscal_year", "metric", "value", "source_file", "source_url", "notes"],
    aggregateRows,
  );
  console.log(`✅  ${aggregateRows.length} real FTA anchor rows inserted.`);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. taxpayers
  // ─────────────────────────────────────────────────────────────────────────
  console.log("⏳  Generating taxpayers …");
  interface Taxpayer {
    trn: string;
    segment: "Large" | "Medium" | "Small" | "Micro";
    vatRegistered: boolean;
    exciseRegistered: boolean;
    ctRegistered: boolean;
    vatFilingFrequency: "Monthly" | "Quarterly" | null;
    emirate: string;
    industry: string;
  }
  const taxpayers: Taxpayer[] = [];
  const taxpayerRows: unknown[][] = [];

  for (let i = 0; i < POC_SAMPLE.taxpayers; i++) {
    const segment = pickWeighted(rng, SEGMENT_DISTRIBUTION) as Taxpayer["segment"];
    const emirate = pickWeighted(rng, EMIRATE_DISTRIBUTION);
    const industry = pickWeighted(rng, INDUSTRY_DISTRIBUTION);
    const vatRegistered = chance(rng, 0.95);
    const exciseRegistered =
      ["Manufacturing", "Wholesale & Retail Trade"].includes(industry) &&
      chance(rng, 0.08);
    const ctRegistered = chance(rng, 0.92);
    const vatFilingFrequency: Taxpayer["vatFilingFrequency"] = !vatRegistered
      ? null
      : segment === "Large" || (segment === "Medium" && chance(rng, 0.4))
        ? "Monthly"
        : "Quarterly";

    const trn = generateTRN(i + 1);
    const nameEn = genEnglishName();
    const nameAr = chance(rng, 0.85) ? genArabicName() : null;
    const entityType =
      segment === "Large"
        ? pick(rng, ["LLC", "FZ-LLC", "Branch"] as const)
        : segment === "Medium"
          ? pick(rng, ["LLC", "FZ-LLC", "Sole Establishment"] as const)
          : pick(rng, ["LLC", "Sole Establishment"] as const);
    const freeZone = pick(rng, FREE_ZONES);
    const regYear = randInt(rng, 2018, 2024);
    const regMonth = randInt(rng, 1, 12);
    const regDay = randInt(rng, 1, 28);
    const registrationDate = `${regYear}-${String(regMonth).padStart(2, "0")}-${String(regDay).padStart(2, "0")}`;

    let status: string;
    const sr = rng();
    if (sr < 0.88) status = "Active";
    else if (sr < 0.95) status = "Dormant";
    else if (sr < 0.985) status = "Suspended";
    else status = "Deregistered";

    let isSeededDormantMismatch = false;
    if (i < SEEDED_CONDITIONS.registryDormantFlaggedActive) {
      status = "Active";
      isSeededDormantMismatch = true;
    }
    let email: string | null = `info@${nameEn.toLowerCase().replace(/[^a-z]+/g, "")}.ae`;
    let phone: string | null = `${emiratePrefix(emirate)}${randInt(rng, 1000000, 9999999)}`;
    if (i >= 100 && i < 100 + SEEDED_CONDITIONS.registryMissingContact) {
      if (chance(rng, 0.5)) email = null;
      else phone = null;
    }
    const beneficialOwner =
      entityType === "Sole Establishment"
        ? null
        : `${pick(rng, ENGLISH_CORE)} Holdings`;

    taxpayerRows.push([
      trn,
      nameEn,
      nameAr,
      entityType,
      segment,
      industry,
      emirate,
      freeZone,
      registrationDate,
      status,
      email,
      phone,
      `${randInt(rng, 1, 999)} ${pick(rng, ["Sheikh Zayed Rd", "Al Khaleej St", "Corniche", "Marina Walk"])}, ${emirate}`,
      beneficialOwner,
      null,
      vatRegistered,
      exciseRegistered,
      ctRegistered,
      vatFilingFrequency,
      null,
      false,
      isSeededDormantMismatch,
    ]);
    taxpayers.push({
      trn,
      segment,
      vatRegistered,
      exciseRegistered,
      ctRegistered,
      vatFilingFrequency,
      emirate,
      industry,
    });
  }

  // Seeded duplicates
  for (let d = 0; d < SEEDED_CONDITIONS.registryDuplicates; d++) {
    const orig = taxpayers[d];
    const dupTrn = generateTRN(POC_SAMPLE.taxpayers + d + 1);
    const dupNameEn = `${pick(rng, ENGLISH_PREFIXES)} ${pick(rng, ENGLISH_CORE)} ${pick(rng, ENGLISH_SUFFIXES)} LLC`;
    taxpayerRows.push([
      dupTrn,
      dupNameEn,
      null,
      "LLC",
      orig.segment,
      orig.industry,
      orig.emirate,
      null,
      "2024-06-15",
      "Active",
      null,
      `+9714${randInt(rng, 1000000, 9999999)}`,
      "Same address as primary",
      "Holdings Ltd",
      null,
      orig.vatRegistered,
      false,
      orig.ctRegistered,
      orig.vatFilingFrequency,
      null,
      true,
      false,
    ]);
  }

  await batchInsert(
    client,
    "taxpayers",
    [
      "trn",
      "legal_name_en",
      "legal_name_ar",
      "entity_type",
      "segment",
      "industry",
      "emirate",
      "free_zone",
      "registration_date",
      "status",
      "email",
      "phone",
      "address_line",
      "beneficial_owner_name",
      "parent_group_trn",
      "vat_registered",
      "excise_registered",
      "ct_registered",
      "vat_filing_frequency",
      "last_filing_date",
      "is_seeded_duplicate",
      "is_seeded_dormant_mismatch",
    ],
    taxpayerRows,
  );
  console.log(
    `✅  ${taxpayers.length} taxpayers + ${SEEDED_CONDITIONS.registryDuplicates} seeded duplicates inserted.`,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 3. declarations
  // ─────────────────────────────────────────────────────────────────────────
  console.log("⏳  Generating declarations …");
  const PERIODS_VAT_MONTHLY: Array<[string, string, string]> = [];
  const PERIODS_VAT_QUARTERLY: Array<[string, string, string]> = [];
  for (let m = 1; m <= 12; m++) {
    const periodStart = `${FY}-${String(m).padStart(2, "0")}-01`;
    const periodEnd = endOfMonth(FY, m);
    const dueDate = nthOfMonthAfter(FY, m, STATUTORY_DUE_DAYS.VAT);
    PERIODS_VAT_MONTHLY.push([periodStart, periodEnd, dueDate]);
  }
  for (const q of [1, 2, 3, 4]) {
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    const periodStart = `${FY}-${String(startMonth).padStart(2, "0")}-01`;
    const periodEnd = endOfMonth(FY, endMonth);
    const dueDate = nthOfMonthAfter(FY, endMonth, STATUTORY_DUE_DAYS.VAT);
    PERIODS_VAT_QUARTERLY.push([periodStart, periodEnd, dueDate]);
  }

  let totalOnTime = 0,
    totalLate = 0,
    totalNotFiled = 0;
  const declarationsList: Array<{
    declarationId: string;
    trn: string;
    taxType: "VAT" | "EXCISE" | "CT";
    dueDate: string;
    filedDate: string | null;
    taxDue: number;
    status: string;
    isElectronic: boolean;
  }> = [];
  const declRows: unknown[][] = [];

  for (const tp of taxpayers) {
    // VAT
    if (tp.vatRegistered) {
      const periods =
        tp.vatFilingFrequency === "Monthly"
          ? PERIODS_VAT_MONTHLY
          : PERIODS_VAT_QUARTERLY;
      for (const [periodStart, periodEnd, dueDate] of periods) {
        const onTime = chance(rng, SEEDED_CONDITIONS.vatOnTimeFilingRate);
        const electronic = chance(rng, SEEDED_CONDITIONS.electronicFilingRate);
        const declarationId = `VAT-${periodEnd}-${tp.trn}`;
        let filedDate: string | null;
        let status: string;
        let isLate = false;
        if (onTime) {
          filedDate = addDays(dueDate, -randInt(rng, 0, 14));
          status = "Filed";
          totalOnTime++;
        } else if (chance(rng, 0.35)) {
          filedDate = null;
          status = "NotFiled";
          totalNotFiled++;
        } else {
          filedDate = addDays(dueDate, randInt(rng, 1, 60));
          status = "Filed";
          isLate = true;
          totalLate++;
        }
        const baseDue =
          tp.segment === "Large"
            ? randInt(rng, 100_000, 5_000_000)
            : tp.segment === "Medium"
              ? randInt(rng, 20_000, 200_000)
              : tp.segment === "Small"
                ? randInt(rng, 2_000, 30_000)
                : randInt(rng, 500, 5_000);
        const refund = chance(rng, 0.06) ? randInt(rng, 1_000, 50_000) : 0;
        const taxDue = refund > 0 ? -refund : baseDue;
        declRows.push([
          declarationId,
          tp.trn,
          "VAT",
          periodStart,
          periodEnd,
          dueDate,
          filedDate,
          status === "Filed" ? (electronic ? "Portal" : "Paper") : null,
          status,
          taxDue,
          refund,
          isLate,
          electronic,
        ]);
        declarationsList.push({
          declarationId,
          trn: tp.trn,
          taxType: "VAT",
          dueDate,
          filedDate,
          taxDue,
          status,
          isElectronic: electronic,
        });
      }
    }
    // EXCISE
    if (tp.exciseRegistered) {
      for (let m = 1; m <= 12; m++) {
        const periodStart = `${FY}-${String(m).padStart(2, "0")}-01`;
        const periodEnd = endOfMonth(FY, m);
        const dueDate = nthOfMonthAfter(FY, m, STATUTORY_DUE_DAYS.EXCISE);
        const onTime = chance(rng, SEEDED_CONDITIONS.exciseOnTimeFilingRate);
        const electronic = chance(rng, SEEDED_CONDITIONS.electronicFilingRate);
        let filedDate: string | null;
        let status: string;
        let isLate = false;
        if (onTime) {
          filedDate = addDays(dueDate, -randInt(rng, 0, 10));
          status = "Filed";
          totalOnTime++;
        } else if (chance(rng, 0.2)) {
          filedDate = null;
          status = "NotFiled";
          totalNotFiled++;
        } else {
          filedDate = addDays(dueDate, randInt(rng, 1, 45));
          status = "Filed";
          isLate = true;
          totalLate++;
        }
        const taxDue = randInt(rng, 5_000, 500_000);
        const declarationId = `EXC-${periodEnd}-${tp.trn}`;
        declRows.push([
          declarationId,
          tp.trn,
          "EXCISE",
          periodStart,
          periodEnd,
          dueDate,
          filedDate,
          status === "Filed" ? (electronic ? "Portal" : "Paper") : null,
          status,
          taxDue,
          0,
          isLate,
          electronic,
        ]);
        declarationsList.push({
          declarationId,
          trn: tp.trn,
          taxType: "EXCISE",
          dueDate,
          filedDate,
          taxDue,
          status,
          isElectronic: electronic,
        });
      }
    }
    // CT
    if (tp.ctRegistered) {
      const periodStart = `${FY - 1}-01-01`;
      const periodEnd = `${FY - 1}-12-31`;
      const dueDate = `${FY}-09-30`;
      const onTime = chance(rng, SEEDED_CONDITIONS.citOnTimeFilingRate);
      const electronic = chance(rng, SEEDED_CONDITIONS.electronicFilingRate);
      let filedDate: string | null;
      let status: string;
      let isLate = false;
      if (onTime) {
        filedDate = addDays(dueDate, -randInt(rng, 0, 60));
        status = "Filed";
        totalOnTime++;
      } else if (chance(rng, 0.4)) {
        filedDate = null;
        status = "NotFiled";
        totalNotFiled++;
      } else {
        filedDate = addDays(dueDate, randInt(rng, 1, 90));
        status = "Filed";
        isLate = true;
        totalLate++;
      }
      const taxDue =
        tp.segment === "Large"
          ? randInt(rng, 500_000, 20_000_000)
          : tp.segment === "Medium"
            ? randInt(rng, 50_000, 500_000)
            : tp.segment === "Small"
              ? randInt(rng, 5_000, 50_000)
              : 0;
      const declarationId = `CT-${FY - 1}-${tp.trn}`;
      declRows.push([
        declarationId,
        tp.trn,
        "CT",
        periodStart,
        periodEnd,
        dueDate,
        filedDate,
        status === "Filed" ? (electronic ? "Portal" : "Paper") : null,
        status,
        taxDue,
        0,
        isLate,
        electronic,
      ]);
      declarationsList.push({
        declarationId,
        trn: tp.trn,
        taxType: "CT",
        dueDate,
        filedDate,
        taxDue,
        status,
        isElectronic: electronic,
      });
    }
  }

  await batchInsert(
    client,
    "declarations",
    [
      "declaration_id",
      "trn",
      "tax_type",
      "period_start",
      "period_end",
      "statutory_due_date",
      "filed_date",
      "filing_channel",
      "status",
      "declared_tax_due",
      "declared_refund",
      "is_late",
      "is_electronic",
    ],
    declRows,
  );
  console.log(
    `✅  ${declarationsList.length} declarations inserted ` +
      `(${totalOnTime} on-time / ${totalLate} late / ${totalNotFiled} not filed).`,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 4. payments
  // ─────────────────────────────────────────────────────────────────────────
  console.log("⏳  Generating payments …");
  let paymentSeq = 0;
  let onTimePayments = 0;
  let totalPayments = 0;
  let onTimeValue = 0;
  let totalValue = 0;
  const unpaidDecls: typeof declarationsList = [];
  const payRows: unknown[][] = [];

  for (const d of declarationsList) {
    if (d.status !== "Filed" || d.taxDue <= 0) {
      if (d.status !== "Filed") unpaidDecls.push(d);
      continue;
    }
    const onTime = chance(rng, SEEDED_CONDITIONS.vatOnTimePaymentRateByNumber);
    const electronic = chance(rng, SEEDED_CONDITIONS.electronicPaymentRate);
    let paymentDate: string;
    let isLate = false;
    if (onTime) {
      paymentDate = addDays(d.dueDate, -randInt(rng, 0, 7));
    } else if (chance(rng, 0.3)) {
      unpaidDecls.push(d);
      continue;
    } else {
      paymentDate = addDays(d.dueDate, randInt(rng, 1, 90));
      isLate = true;
    }
    const postedDate = chance(rng, 0.85) ? paymentDate : addDays(paymentDate, 1);
    const method = electronic
      ? pick(rng, ["eDirham", "BankTransfer", "DirectDebit", "Card"] as const)
      : pick(rng, ["Cheque", "Cash"] as const);
    paymentSeq++;
    const paymentId = `PAY-${String(paymentSeq).padStart(8, "0")}`;
    payRows.push([
      paymentId,
      d.trn,
      d.taxType,
      d.declarationId,
      d.dueDate,
      paymentDate,
      postedDate,
      d.taxDue,
      method,
      electronic,
      isLate,
    ]);
    totalPayments++;
    totalValue += d.taxDue;
    if (!isLate) {
      onTimePayments++;
      onTimeValue += d.taxDue;
    }
  }

  await batchInsert(
    client,
    "payments",
    [
      "payment_id",
      "trn",
      "tax_type",
      "linked_declaration_id",
      "statutory_due_date",
      "payment_date",
      "posted_date",
      "amount_aed",
      "payment_method",
      "is_electronic",
      "is_late",
    ],
    payRows,
  );
  console.log(
    `✅  ${totalPayments} payments inserted ` +
      `(on-time: ${((onTimePayments / totalPayments) * 100).toFixed(1)}% by number, ` +
      `${((onTimeValue / totalValue) * 100).toFixed(1)}% by value).`,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 5. arrears_ledger
  // ─────────────────────────────────────────────────────────────────────────
  console.log("⏳  Generating arrears ledger …");
  const REPORT_DATE = new Date(`${FY}-12-31T00:00:00Z`);
  function ageDays(dueIso: string): number {
    const d = new Date(dueIso + "T00:00:00Z");
    return Math.floor((REPORT_DATE.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  }
  function ageBucket(days: number): string {
    if (days <= 30) return "0-30";
    if (days <= 90) return "31-90";
    if (days <= 365) return "91-365";
    return ">365";
  }
  let arrearsSeq = 0;
  let totalArrearsValue = 0;
  let collectibleValue = 0;
  let oldValue = 0;
  const arrRows: unknown[][] = [];

  for (const d of unpaidDecls) {
    if (d.taxDue <= 0) continue;
    arrearsSeq++;
    let dueDate = d.dueDate;
    if (chance(rng, SEEDED_CONDITIONS.oldArrearsRatio * 1.1)) {
      dueDate = addDays(d.dueDate, -randInt(rng, 395, 1095));
    }
    const days = ageDays(dueDate);
    const bucket = ageBucket(days);
    const principal = d.taxDue;
    const penalty = principal * 0.02 * Math.min(12, days / 30);
    const interest = principal * 0.001 * (days / 30);
    const outstanding = principal + penalty + interest;
    const collectible = chance(
      rng,
      1 -
        SEEDED_CONDITIONS.collectibleArrearsRatio /
          SEEDED_CONDITIONS.totalArrearsRatio,
    );
    let status: string;
    if (!collectible) status = pick(rng, ["Disputed", "WrittenOff"] as const);
    else if (chance(rng, 0.15)) status = "PaymentPlan";
    else status = "Active";
    arrRows.push([
      `ARR-${String(arrearsSeq).padStart(7, "0")}`,
      d.trn,
      d.taxType,
      d.declarationId,
      dueDate,
      principal,
      penalty,
      interest,
      outstanding,
      days,
      bucket,
      collectible,
      status,
      FY,
    ]);
    totalArrearsValue += outstanding;
    if (collectible) collectibleValue += outstanding;
    if (bucket === ">365") oldValue += outstanding;
  }

  await batchInsert(
    client,
    "arrears_ledger",
    [
      "arrears_id",
      "trn",
      "tax_type",
      "source_declaration_id",
      "original_due_date",
      "principal_aed",
      "accrued_penalty_aed",
      "accrued_interest_aed",
      "outstanding_total_aed",
      "age_days",
      "age_bucket",
      "collectible_flag",
      "status",
      "fiscal_year",
    ],
    arrRows,
  );
  console.log(
    `✅  ${arrearsSeq} arrears records (total AED ${(totalArrearsValue / 1e6).toFixed(1)}M, ` +
      `collectible AED ${(collectibleValue / 1e6).toFixed(1)}M, ` +
      `>12mo AED ${(oldValue / 1e6).toFixed(1)}M).`,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 6. collections_summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log("⏳  Computing collections summary …");
  const collected = (
    await client.query<{ tax_type: string; total: string }>(
      `SELECT tax_type, COALESCE(SUM(amount_aed), 0)::text AS total
       FROM payments GROUP BY tax_type`,
    )
  ).rows;
  const arrearsByTax = (
    await client.query<{
      tax_type: string;
      total_arrears: string;
      collectible: string;
      over_12mo: string;
    }>(`
      SELECT
        tax_type,
        COALESCE(SUM(outstanding_total_aed), 0)::text AS total_arrears,
        COALESCE(SUM(CASE WHEN collectible_flag=TRUE THEN outstanding_total_aed ELSE 0 END), 0)::text AS collectible,
        COALESCE(SUM(CASE WHEN age_bucket='>365' THEN outstanding_total_aed ELSE 0 END), 0)::text AS over_12mo
      FROM arrears_ledger GROUP BY tax_type
    `)
  ).rows;
  const summaryRows: unknown[][] = [];
  for (const c of collected) {
    const a =
      arrearsByTax.find((x) => x.tax_type === c.tax_type) ?? {
        tax_type: c.tax_type,
        total_arrears: "0",
        collectible: "0",
        over_12mo: "0",
      };
    const total = Number(c.total);
    const tArr = Number(a.total_arrears);
    const tColl = Number(a.collectible);
    const tOld = Number(a.over_12mo);
    summaryRows.push([FY, c.tax_type, total, tArr, tColl, tOld]);
    summaryRows.push([FY - 1, c.tax_type, total * 0.92, tArr * 1.08, tColl * 1.05, tOld * 1.15]);
    summaryRows.push([FY - 2, c.tax_type, total * 0.84, tArr * 1.18, tColl * 1.12, tOld * 1.32]);
  }
  await batchInsert(
    client,
    "collections_summary",
    [
      "fiscal_year",
      "tax_type",
      "total_collected_aed",
      "total_arrears_eoy_aed",
      "collectible_arrears_eoy_aed",
      "arrears_over_12mo_eoy_aed",
    ],
    summaryRows,
  );
  console.log(`✅  collections_summary populated for FY${FY - 2}–${FY}.`);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Update last_filing_date
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`
    UPDATE taxpayers t
    SET last_filing_date = sub.last_filed
    FROM (
      SELECT trn, MAX(filed_date) AS last_filed
      FROM declarations
      WHERE filed_date IS NOT NULL
      GROUP BY trn
    ) sub
    WHERE t.trn = sub.trn
  `);
  console.log("✅  taxpayers.last_filing_date updated.");

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Log run
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(
    `INSERT INTO seed_run_log (rng_seed, taxpayer_count, notes) VALUES ($1,$2,$3)`,
    [
      RNG_SEED,
      taxpayers.length + SEEDED_CONDITIONS.registryDuplicates,
      "Calibrated to TADAT seeded conditions and real FTA aggregate anchors.",
    ],
  );

  // Touch the singleton pool so future getDb() calls see it primed
  getDb();
}

main().catch((e) => {
  console.error("\n❌  seed failed:", e);
  process.exit(1);
});
