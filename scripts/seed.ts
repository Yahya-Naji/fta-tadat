/**
 * Seed the TADAT POC database with calibrated synthetic data.
 *
 * What this does:
 *   1. Inserts real FTA anchor numbers into `fta_aggregates`.
 *   2. Generates 1,000 representative taxpayers (UAE FTA distribution).
 *   3. Generates 12 months of VAT/Excise declarations + Corporate Tax annual.
 *   4. Generates payments calibrated to TADAT seeded conditions:
 *        - VAT on-time payment (number) ≈ 84%   → expected score B
 *        - VAT on-time payment (value)  ≈ 88%   → expected score B
 *   5. Generates arrears with realistic aging:
 *        - total arrears / collections ≈ 18%   → B
 *        - >12-month arrears / total   ≈ 32%   → B
 *   6. Injects registry quality issues for Agent 1 (duplicates, missing
 *      fields, dormant mismatches).
 *   7. Computes collections_summary rollups for 3 fiscal years.
 *
 * The numbers in `data/seed/fta-anchors.ts` are real, downloaded directly
 * from https://tax.gov.ae/en/open.data/open.data.aspx
 *
 * Reproducibility: uses a seeded RNG. Same seed → identical DB.
 */
import Database from "better-sqlite3";
import { join } from "node:path";

import {
  FTA_ANNUAL,
  EMIRATE_DISTRIBUTION,
  INDUSTRY_DISTRIBUTION,
  SEGMENT_DISTRIBUTION,
  SEEDED_CONDITIONS,
  POC_SAMPLE,
  STATUTORY_DUE_DAYS,
} from "../data/seed/fta-anchors";
import { makeRng, pickWeighted, pick, chance, randInt } from "../data/seed/random";
import {
  ENGLISH_PREFIXES,
  ENGLISH_CORE,
  ENGLISH_SUFFIXES,
  ENTITY_FORMS,
  ARABIC_FRAGMENTS,
  FREE_ZONES,
} from "../data/seed/uae-names";

const DB_PATH = join(process.cwd(), "data", "tadat-fta.db");
const RNG_SEED = 20260505;
const rng = makeRng(RNG_SEED);

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

// ----------------------------------------------------------------------------
// 1. fta_aggregates — load real anchor numbers
// ----------------------------------------------------------------------------
console.log("⏳  Inserting real FTA anchor numbers …");
const insAgg = db.prepare(
  `INSERT INTO fta_aggregates (fiscal_year, metric, value, source_file, source_url, notes)
   VALUES (?,?,?,?,?,?)`
);
const FTA_OPEN_DATA_URL = "https://tax.gov.ae/en/open.data/open.data.aspx";

const aggregateRows: Array<[number, string, number, string, string, string]> = [];
for (const yr of FTA_ANNUAL) {
  if (yr.vatRegistrations !== undefined) {
    aggregateRows.push([yr.year, "vat_registrations", yr.vatRegistrations,
      "Selected Services Results.xlsx", FTA_OPEN_DATA_URL, "VAT registrations approved"]);
  }
  if (yr.vatDeregistrations !== undefined) {
    aggregateRows.push([yr.year, "vat_deregistrations", yr.vatDeregistrations,
      "Selected Services Results.xlsx", FTA_OPEN_DATA_URL, "VAT deregistrations"]);
  }
  if (yr.exciseRegistrations !== undefined) {
    aggregateRows.push([yr.year, "excise_registrations", yr.exciseRegistrations,
      "Excise Registerations.xlsx", FTA_OPEN_DATA_URL, "Excise tax registrations approved"]);
  }
  if (yr.corporateTaxRegistrations !== undefined) {
    aggregateRows.push([yr.year, "corporate_tax_registrations", yr.corporateTaxRegistrations,
      "Open data 2025 full year - final.xlsx", FTA_OPEN_DATA_URL, "Corporate Tax registrations"]);
  }
  if (yr.reconsiderations !== undefined) {
    aggregateRows.push([yr.year, "reconsiderations", yr.reconsiderations,
      "Reconsideration Request approved by the FTA.xlsx", FTA_OPEN_DATA_URL, "Reconsideration disputes approved"]);
  }
  if (yr.inquiries !== undefined) {
    aggregateRows.push([yr.year, "inquiries", yr.inquiries,
      "No. of Inquiry Request submitted in the year of 2023 - 2024.xlsx", FTA_OPEN_DATA_URL, "Inquiry requests"]);
  }
  if (yr.complaints !== undefined) {
    aggregateRows.push([yr.year, "complaints", yr.complaints,
      "Submit Complaints-META.xlsx", FTA_OPEN_DATA_URL, "Complaints submitted"]);
  }
  if (yr.cumulativeVatRegistrants !== undefined) {
    aggregateRows.push([yr.year, "cumulative_vat_registrants", yr.cumulativeVatRegistrants,
      "Approved VAT registeration.xlsx", FTA_OPEN_DATA_URL, "Running total approved VAT registrants"]);
  }
}
db.transaction(() => {
  for (const r of aggregateRows) insAgg.run(...r);
})();
console.log(`✅  ${aggregateRows.length} real FTA anchor rows inserted.`);

// ----------------------------------------------------------------------------
// 2. taxpayers — generate the registry
// ----------------------------------------------------------------------------
console.log("⏳  Generating taxpayers …");

function generateTRN(seq: number): string {
  // UAE TRN: 15 digits, starts 100, ends 00003. Middle is sequential + random.
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

const insTaxpayer = db.prepare(`
  INSERT INTO taxpayers (
    trn, legal_name_en, legal_name_ar, entity_type, segment, industry,
    emirate, free_zone, registration_date, status,
    email, phone, address_line, beneficial_owner_name, parent_group_trn,
    vat_registered, excise_registered, ct_registered,
    vat_filing_frequency, last_filing_date,
    is_seeded_duplicate, is_seeded_dormant_mismatch
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

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

const insertTaxpayers = db.transaction(() => {
  for (let i = 0; i < POC_SAMPLE.taxpayers; i++) {
    const segment = pickWeighted(rng, SEGMENT_DISTRIBUTION) as Taxpayer["segment"];
    const emirate = pickWeighted(rng, EMIRATE_DISTRIBUTION);
    const industry = pickWeighted(rng, INDUSTRY_DISTRIBUTION);

    // Tax obligations: nearly all VAT-registered (mandatory threshold), most CT, some Excise
    const vatRegistered = chance(rng, 0.95);
    // Excise applies only to specific industries
    const exciseRegistered =
      ["Manufacturing", "Wholesale & Retail Trade"].includes(industry) && chance(rng, 0.08);
    const ctRegistered = chance(rng, 0.92);

    // VAT filing frequency: large=monthly, others mostly quarterly
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

    // Status — most active. Some are dormant or deregistered.
    let status: string;
    const sr = rng();
    if (sr < 0.88) status = "Active";
    else if (sr < 0.95) status = "Dormant";
    else if (sr < 0.985) status = "Suspended";
    else status = "Deregistered";

    // ─── Seeded P1-1-2 issues ─────────────────────────────────────────────
    // Dormant flagged active: status='Active' but no filings in 24+ months
    let isSeededDormantMismatch = 0;
    if (i < SEEDED_CONDITIONS.registryDormantFlaggedActive) {
      status = "Active";
      isSeededDormantMismatch = 1;
    }
    // Missing contact info
    let email: string | null = `info@${nameEn.toLowerCase().replace(/[^a-z]+/g, "")}.ae`;
    let phone: string | null = `${emiratePrefix(emirate)}${randInt(rng, 1000000, 9999999)}`;
    if (i >= 100 && i < 100 + SEEDED_CONDITIONS.registryMissingContact) {
      if (chance(rng, 0.5)) email = null;
      else phone = null;
    }

    // Beneficial owner — required for entities (P1-1-1)
    const beneficialOwner =
      entityType === "Sole Establishment"
        ? null
        : `${pick(rng, ENGLISH_CORE)} Holdings`;

    insTaxpayer.run(
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
      vatRegistered ? 1 : 0,
      exciseRegistered ? 1 : 0,
      ctRegistered ? 1 : 0,
      vatFilingFrequency,
      null, // updated later
      0,
      isSeededDormantMismatch
    );

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

  // ─── Seeded duplicates ────────────────────────────────────────────────
  // Insert N additional rows with same legal_name_en + emirate as existing → soft duplicates
  for (let d = 0; d < SEEDED_CONDITIONS.registryDuplicates; d++) {
    const orig = taxpayers[d];
    const dupTrn = generateTRN(POC_SAMPLE.taxpayers + d + 1);
    const dupNameEn = `${pick(rng, ENGLISH_PREFIXES)} ${pick(rng, ENGLISH_CORE)} ${pick(rng, ENGLISH_SUFFIXES)} LLC`;

    insTaxpayer.run(
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
      null, // missing email — both duplicate AND quality issue
      `+9714${randInt(rng, 1000000, 9999999)}`,
      "Same address as primary",
      "Holdings Ltd",
      null,
      orig.vatRegistered ? 1 : 0,
      0,
      orig.ctRegistered ? 1 : 0,
      orig.vatFilingFrequency,
      null,
      1, // is_seeded_duplicate
      0
    );
  }
});
insertTaxpayers();
console.log(`✅  ${taxpayers.length} taxpayers + ${SEEDED_CONDITIONS.registryDuplicates} seeded duplicates inserted.`);

// ----------------------------------------------------------------------------
// 3. declarations — 12 months of VAT + Excise + CT annual
// ----------------------------------------------------------------------------
console.log("⏳  Generating declarations …");

const insDecl = db.prepare(`
  INSERT INTO declarations (
    declaration_id, trn, tax_type, period_start, period_end,
    statutory_due_date, filed_date, filing_channel, status,
    declared_tax_due, declared_refund, is_late, is_electronic
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const FY = 2025; // primary fiscal year for the POC
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

function endOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}
function nthOfMonthAfter(year: number, month: number, day: number): string {
  // Day in the month after the period end month.
  const target = new Date(Date.UTC(year, month, day)); // month is 0-indexed → month means next
  return target.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let totalDeclsExpected = 0;
let totalDeclsFiledOnTime = 0;
let totalDeclsFiledLate = 0;
let totalDeclsNotFiled = 0;
let totalDeclsElectronic = 0;
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

const insertDeclarations = db.transaction(() => {
  for (const tp of taxpayers) {
    // ── VAT ────────────────────────────────────────────────────────────────
    if (tp.vatRegistered) {
      const periods =
        tp.vatFilingFrequency === "Monthly" ? PERIODS_VAT_MONTHLY : PERIODS_VAT_QUARTERLY;
      for (const [periodStart, periodEnd, dueDate] of periods) {
        totalDeclsExpected++;
        const onTime = chance(rng, SEEDED_CONDITIONS.vatOnTimeFilingRate);
        const electronic = chance(rng, SEEDED_CONDITIONS.electronicFilingRate);

        const declarationId = `VAT-${periodEnd}-${tp.trn}`;
        let filedDate: string | null;
        let status: string;
        let isLate = 0;
        if (onTime) {
          filedDate = addDays(dueDate, -randInt(rng, 0, 14));
          status = "Filed";
          totalDeclsFiledOnTime++;
        } else if (chance(rng, 0.35)) {
          filedDate = null;
          status = "NotFiled";
          totalDeclsNotFiled++;
        } else {
          filedDate = addDays(dueDate, randInt(rng, 1, 60));
          status = "Filed";
          isLate = 1;
          totalDeclsFiledLate++;
        }
        if (electronic) totalDeclsElectronic++;

        // Tax due: scaled by segment
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

        insDecl.run(
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
          electronic ? 1 : 0
        );

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

    // ── EXCISE (monthly) ───────────────────────────────────────────────────
    if (tp.exciseRegistered) {
      for (let m = 1; m <= 12; m++) {
        totalDeclsExpected++;
        const periodStart = `${FY}-${String(m).padStart(2, "0")}-01`;
        const periodEnd = endOfMonth(FY, m);
        const dueDate = nthOfMonthAfter(FY, m, STATUTORY_DUE_DAYS.EXCISE);
        const onTime = chance(rng, SEEDED_CONDITIONS.exciseOnTimeFilingRate);
        const electronic = chance(rng, SEEDED_CONDITIONS.electronicFilingRate);

        let filedDate: string | null;
        let status: string;
        let isLate = 0;
        if (onTime) {
          filedDate = addDays(dueDate, -randInt(rng, 0, 10));
          status = "Filed";
          totalDeclsFiledOnTime++;
        } else if (chance(rng, 0.2)) {
          filedDate = null;
          status = "NotFiled";
          totalDeclsNotFiled++;
        } else {
          filedDate = addDays(dueDate, randInt(rng, 1, 45));
          status = "Filed";
          isLate = 1;
          totalDeclsFiledLate++;
        }
        if (electronic) totalDeclsElectronic++;

        const taxDue = randInt(rng, 5_000, 500_000);
        const declarationId = `EXC-${periodEnd}-${tp.trn}`;
        insDecl.run(
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
          electronic ? 1 : 0
        );

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

    // ── CT (annual, FY2024 due Sep 2025) ──────────────────────────────────
    if (tp.ctRegistered) {
      totalDeclsExpected++;
      const periodStart = `${FY - 1}-01-01`;
      const periodEnd = `${FY - 1}-12-31`;
      // Due 9 months after FY end → Sep 30 of FY
      const dueDate = `${FY}-09-30`;
      const onTime = chance(rng, SEEDED_CONDITIONS.citOnTimeFilingRate);
      const electronic = chance(rng, SEEDED_CONDITIONS.electronicFilingRate);

      let filedDate: string | null;
      let status: string;
      let isLate = 0;
      if (onTime) {
        filedDate = addDays(dueDate, -randInt(rng, 0, 60));
        status = "Filed";
        totalDeclsFiledOnTime++;
      } else if (chance(rng, 0.4)) {
        filedDate = null;
        status = "NotFiled";
        totalDeclsNotFiled++;
      } else {
        filedDate = addDays(dueDate, randInt(rng, 1, 90));
        status = "Filed";
        isLate = 1;
        totalDeclsFiledLate++;
      }
      if (electronic) totalDeclsElectronic++;

      const taxDue =
        tp.segment === "Large"
          ? randInt(rng, 500_000, 20_000_000)
          : tp.segment === "Medium"
            ? randInt(rng, 50_000, 500_000)
            : tp.segment === "Small"
              ? randInt(rng, 5_000, 50_000)
              : 0; // Small Business Relief — first AED 375k revenue exempt
      const declarationId = `CT-${FY - 1}-${tp.trn}`;
      insDecl.run(
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
        electronic ? 1 : 0
      );

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
});
insertDeclarations();
console.log(
  `✅  ${declarationsList.length} declarations inserted ` +
    `(${totalDeclsFiledOnTime} on-time / ${totalDeclsFiledLate} late / ${totalDeclsNotFiled} not filed).`
);

// ----------------------------------------------------------------------------
// 4. payments — calibrated to seeded on-time payment rates
// ----------------------------------------------------------------------------
console.log("⏳  Generating payments …");

const insPay = db.prepare(`
  INSERT INTO payments (
    payment_id, trn, tax_type, linked_declaration_id,
    statutory_due_date, payment_date, posted_date,
    amount_aed, payment_method, is_electronic, is_late
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
`);

let paymentSeq = 0;
let totalPayments = 0;
let onTimePayments = 0;
let onTimePaymentValue = 0;
let totalPaymentValue = 0;
const unpaidDecls: typeof declarationsList = [];

const insertPayments = db.transaction(() => {
  for (const d of declarationsList) {
    if (d.status !== "Filed" || d.taxDue <= 0) {
      // Refunds and not-filed → no payment
      if (d.status !== "Filed") unpaidDecls.push(d);
      continue;
    }

    const onTime = chance(rng, SEEDED_CONDITIONS.vatOnTimePaymentRateByNumber);
    const electronic = chance(rng, SEEDED_CONDITIONS.electronicPaymentRate);
    let paymentDate: string;
    let isLate = 0;
    if (onTime) {
      paymentDate = addDays(d.dueDate, -randInt(rng, 0, 7));
    } else if (chance(rng, 0.3)) {
      // No payment at all → goes to arrears
      unpaidDecls.push(d);
      continue;
    } else {
      paymentDate = addDays(d.dueDate, randInt(rng, 1, 90));
      isLate = 1;
    }
    // Posted same day or +1 business day (matches TADAT P8-30 expectation)
    const postedDate = chance(rng, 0.85)
      ? paymentDate
      : addDays(paymentDate, 1);

    const method = electronic
      ? pick(rng, ["eDirham", "BankTransfer", "DirectDebit", "Card"] as const)
      : pick(rng, ["Cheque", "Cash"] as const);

    paymentSeq++;
    const paymentId = `PAY-${String(paymentSeq).padStart(8, "0")}`;
    insPay.run(
      paymentId,
      d.trn,
      d.taxType,
      d.declarationId,
      d.dueDate,
      paymentDate,
      postedDate,
      d.taxDue,
      method,
      electronic ? 1 : 0,
      isLate
    );

    totalPayments++;
    totalPaymentValue += d.taxDue;
    if (!isLate) {
      onTimePayments++;
      onTimePaymentValue += d.taxDue;
    }
  }
});
insertPayments();
console.log(
  `✅  ${totalPayments} payments inserted ` +
    `(on-time: ${((onTimePayments / totalPayments) * 100).toFixed(1)}% by number, ` +
    `${((onTimePaymentValue / totalPaymentValue) * 100).toFixed(1)}% by value).`
);

// ----------------------------------------------------------------------------
// 5. arrears_ledger — calibrated aging
// ----------------------------------------------------------------------------
console.log("⏳  Generating arrears ledger …");

const insArr = db.prepare(`
  INSERT INTO arrears_ledger (
    arrears_id, trn, tax_type, source_declaration_id,
    original_due_date, principal_aed, accrued_penalty_aed,
    accrued_interest_aed, outstanding_total_aed,
    age_days, age_bucket, collectible_flag, status, fiscal_year
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

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
let collectibleArrearsValue = 0;
let oldArrearsValue = 0;

const insertArrears = db.transaction(() => {
  for (const d of unpaidDecls) {
    if (d.taxDue <= 0) continue;

    arrearsSeq++;
    let dueDate = d.dueDate;
    // To hit ~32% >12-month-old arrears, force a portion of records into older buckets
    if (chance(rng, SEEDED_CONDITIONS.oldArrearsRatio * 1.1)) {
      // Backdate due date 13–36 months earlier
      dueDate = addDays(d.dueDate, -randInt(rng, 395, 1095));
    }
    const days = ageDays(dueDate);
    const bucket = ageBucket(days);
    const principal = d.taxDue;
    const penalty = principal * 0.02 * Math.min(12, days / 30); // 2% per month capped 12
    const interest = principal * 0.001 * (days / 30);
    const outstanding = principal + penalty + interest;
    const collectible = chance(rng, 1 - SEEDED_CONDITIONS.collectibleArrearsRatio / SEEDED_CONDITIONS.totalArrearsRatio);
    // ↑ this distributes collectible flag so collectible/total ratio matches seeded condition

    let status: string;
    if (!collectible) status = pick(rng, ["Disputed", "WrittenOff"] as const);
    else if (chance(rng, 0.15)) status = "PaymentPlan";
    else status = "Active";

    insArr.run(
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
      collectible ? 1 : 0,
      status,
      FY
    );

    totalArrearsValue += outstanding;
    if (collectible) collectibleArrearsValue += outstanding;
    if (bucket === ">365") oldArrearsValue += outstanding;
  }
});
insertArrears();
console.log(
  `✅  ${arrearsSeq} arrears records (total AED ${(totalArrearsValue / 1e6).toFixed(1)}M, ` +
    `collectible AED ${(collectibleArrearsValue / 1e6).toFixed(1)}M, ` +
    `>12mo AED ${(oldArrearsValue / 1e6).toFixed(1)}M).`
);

// ----------------------------------------------------------------------------
// 6. collections_summary — 3 fiscal years (FY-2, FY-1, FY) for TADAT 3-year avg
// ----------------------------------------------------------------------------
console.log("⏳  Computing collections summary …");

const collected = db.prepare(`
  SELECT tax_type, SUM(amount_aed) AS total
  FROM payments
  GROUP BY tax_type
`).all() as Array<{ tax_type: string; total: number }>;

const arrearsByTax = db.prepare(`
  SELECT
    tax_type,
    SUM(outstanding_total_aed) AS total_arrears,
    SUM(CASE WHEN collectible_flag=1 THEN outstanding_total_aed ELSE 0 END) AS collectible,
    SUM(CASE WHEN age_bucket='>365' THEN outstanding_total_aed ELSE 0 END) AS over_12mo
  FROM arrears_ledger
  GROUP BY tax_type
`).all() as Array<{ tax_type: string; total_arrears: number; collectible: number; over_12mo: number }>;

const insSum = db.prepare(`
  INSERT INTO collections_summary
    (fiscal_year, tax_type, total_collected_aed, total_arrears_eoy_aed,
     collectible_arrears_eoy_aed, arrears_over_12mo_eoy_aed)
  VALUES (?,?,?,?,?,?)
`);

const insertSummary = db.transaction(() => {
  for (const c of collected) {
    const a = arrearsByTax.find((x) => x.tax_type === c.tax_type) ?? {
      tax_type: c.tax_type,
      total_arrears: 0,
      collectible: 0,
      over_12mo: 0,
    };
    // FY (current) — actual data
    insSum.run(FY, c.tax_type, c.total, a.total_arrears, a.collectible, a.over_12mo);
    // FY-1 — slight downscale
    insSum.run(
      FY - 1,
      c.tax_type,
      c.total * 0.92,
      a.total_arrears * 1.08,
      a.collectible * 1.05,
      a.over_12mo * 1.15
    );
    // FY-2
    insSum.run(
      FY - 2,
      c.tax_type,
      c.total * 0.84,
      a.total_arrears * 1.18,
      a.collectible * 1.12,
      a.over_12mo * 1.32
    );
  }
});
insertSummary();
console.log(`✅  collections_summary populated for FY${FY - 2}–${FY}.`);

// ----------------------------------------------------------------------------
// 7. Update last_filing_date denormalized field
// ----------------------------------------------------------------------------
db.exec(`
  UPDATE taxpayers
  SET last_filing_date = (
    SELECT MAX(filed_date) FROM declarations d
    WHERE d.trn = taxpayers.trn AND d.filed_date IS NOT NULL
  );
`);
console.log("✅  taxpayers.last_filing_date updated.");

// ----------------------------------------------------------------------------
// 8. Log this run
// ----------------------------------------------------------------------------
db.prepare(
  `INSERT INTO seed_run_log (rng_seed, taxpayer_count, notes) VALUES (?,?,?)`
).run(
  RNG_SEED,
  taxpayers.length + SEEDED_CONDITIONS.registryDuplicates,
  "Calibrated to TADAT seeded conditions and real FTA aggregate anchors."
);

db.close();
console.log("\n🎉  Seed complete.");
