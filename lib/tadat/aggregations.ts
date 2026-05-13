/**
 * Pre-aggregation queries for each TADAT POA. The Quanterra LLM agents do
 * NOT execute SQL — they receive these pre-computed JSON payloads and only
 * apply the scoring rubric + write the narrative. This pattern matches the
 * existing DDA-ISO project and keeps numeric results deterministic.
 */
import { one, many } from "@/lib/db";

// =========================================================================
//   POA 1 — Registry Integrity
// =========================================================================

export interface RegistryAggregations {
  registry_stats: {
    total_records: number;
    by_status: Record<string, number>;
    by_segment: Record<string, number>;
    by_emirate: Record<string, number>;
    by_industry_top5: Record<string, number>;
    missing_email_count: number;
    missing_phone_count: number;
    missing_either_contact_count: number;
    missing_beneficial_owner_count: number;
    soft_duplicate_pairs_count: number;
    active_with_no_recent_filing_count: number;
    vat_registered: number;
    excise_registered: number;
    ct_registered: number;
  };
  sample_issues: {
    soft_duplicates: Array<{
      trn: string;
      name: string;
      emirate: string;
      segment: string;
      industry: string;
      registration_date: string;
    }>;
    missing_contact: Array<{
      trn: string;
      name: string;
      missing: string[];
      segment: string;
      industry: string;
      last_filing_date: string | null;
      vat_registered: boolean;
      ct_registered: boolean;
    }>;
    dormant_active_mismatch: Array<{
      trn: string;
      name: string;
      last_filing_date: string | null;
      segment: string;
      industry: string;
      vat_registered: boolean;
      ct_registered: boolean;
      registration_date: string;
    }>;
  };
  fta_anchors: Record<string, number>;
  period_assessed: string;
}

export async function aggregateRegistry(): Promise<RegistryAggregations> {
  const total = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers`,
  ))?.c ?? 0);

  const byStatus = Object.fromEntries(
    (await many<{ status: string; c: string }>(
      `SELECT status, COUNT(*)::text AS c FROM taxpayers GROUP BY status`,
    )).map((r) => [r.status, Number(r.c)]),
  );
  const bySegment = Object.fromEntries(
    (await many<{ segment: string; c: string }>(
      `SELECT segment, COUNT(*)::text AS c FROM taxpayers GROUP BY segment`,
    )).map((r) => [r.segment, Number(r.c)]),
  );
  const byEmirate = Object.fromEntries(
    (await many<{ emirate: string; c: string }>(
      `SELECT emirate, COUNT(*)::text AS c FROM taxpayers GROUP BY emirate ORDER BY c::int DESC`,
    )).map((r) => [r.emirate, Number(r.c)]),
  );
  const byIndustry = (await many<{ industry: string; c: string }>(
    `SELECT industry, COUNT(*)::text AS c FROM taxpayers GROUP BY industry ORDER BY c::int DESC LIMIT 5`,
  )).map((r) => ({ industry: r.industry, c: Number(r.c) }));

  const missingEmail = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers WHERE email IS NULL`,
  ))?.c ?? 0);
  const missingPhone = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers WHERE phone IS NULL`,
  ))?.c ?? 0);
  const missingEither = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers WHERE email IS NULL OR phone IS NULL`,
  ))?.c ?? 0);
  const missingBO = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers WHERE beneficial_owner_name IS NULL AND entity_type != 'Sole Establishment'`,
  ))?.c ?? 0);

  // Soft duplicates: same legal_name_en within emirate.
  const softDup = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers t1
     WHERE EXISTS (
       SELECT 1 FROM taxpayers t2
       WHERE t2.trn != t1.trn
         AND t2.emirate = t1.emirate
         AND t2.legal_name_en = t1.legal_name_en
     )`,
  ))?.c ?? 0);

  const dormantMismatch = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers
     WHERE status='Active'
       AND vat_registered = TRUE
       AND (last_filing_date IS NULL OR last_filing_date < '2024-01-01'::date)`,
  ))?.c ?? 0);

  const vatReg = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers WHERE vat_registered = TRUE`,
  ))?.c ?? 0);
  const exciseReg = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers WHERE excise_registered = TRUE`,
  ))?.c ?? 0);
  const ctReg = Number((await one<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM taxpayers WHERE ct_registered = TRUE`,
  ))?.c ?? 0);

  // Sample issue rows
  const dupSample = await many<{
    trn: string;
    name: string;
    emirate: string;
    segment: string;
    industry: string;
    registration_date: string;
  }>(`
    SELECT trn, legal_name_en AS name, emirate, segment, industry,
           to_char(registration_date, 'YYYY-MM-DD') AS registration_date
    FROM taxpayers
    WHERE legal_name_en IN (
      SELECT legal_name_en FROM taxpayers
      GROUP BY legal_name_en, emirate HAVING COUNT(*) > 1
    )
    ORDER BY legal_name_en, registration_date
    LIMIT 25
  `);

  const missingSampleRaw = await many<{
    trn: string;
    name: string;
    email: string | null;
    phone: string | null;
    segment: string;
    industry: string;
    last_filing_date: string | null;
    vat_registered: boolean;
    ct_registered: boolean;
  }>(`
    SELECT trn, legal_name_en AS name, email, phone, segment, industry,
           to_char(last_filing_date, 'YYYY-MM-DD') AS last_filing_date,
           vat_registered, ct_registered
    FROM taxpayers
    WHERE email IS NULL OR phone IS NULL
    ORDER BY (CASE WHEN segment='Large' THEN 1 ELSE 2 END), last_filing_date DESC NULLS LAST
    LIMIT 25
  `);

  const dormantSample = await many<{
    trn: string;
    name: string;
    last_filing_date: string | null;
    segment: string;
    industry: string;
    vat_registered: boolean;
    ct_registered: boolean;
    registration_date: string;
  }>(`
    SELECT trn, legal_name_en AS name,
           to_char(last_filing_date, 'YYYY-MM-DD') AS last_filing_date,
           segment, industry, vat_registered, ct_registered,
           to_char(registration_date, 'YYYY-MM-DD') AS registration_date
    FROM taxpayers
    WHERE status='Active' AND vat_registered = TRUE
      AND (last_filing_date IS NULL OR last_filing_date < '2024-01-01'::date)
    ORDER BY (CASE WHEN segment='Large' THEN 1 ELSE 2 END), last_filing_date ASC NULLS FIRST
    LIMIT 25
  `);

  // Real FTA anchors
  const anchors = Object.fromEntries(
    (await many<{ metric: string; value: string }>(`
      SELECT metric, value::text AS value FROM fta_aggregates
      WHERE fiscal_year = 2025 OR (metric='cumulative_vat_registrants' AND fiscal_year=2021)
      ORDER BY fiscal_year DESC
    `)).map((r) => [r.metric, Number(r.value)]),
  );

  return {
    registry_stats: {
      total_records: total,
      by_status: byStatus,
      by_segment: bySegment,
      by_emirate: byEmirate,
      by_industry_top5: Object.fromEntries(byIndustry.map((r) => [r.industry, r.c])),
      missing_email_count: missingEmail,
      missing_phone_count: missingPhone,
      missing_either_contact_count: missingEither,
      missing_beneficial_owner_count: missingBO,
      soft_duplicate_pairs_count: softDup,
      active_with_no_recent_filing_count: dormantMismatch,
      vat_registered: vatReg,
      excise_registered: exciseReg,
      ct_registered: ctReg,
    },
    sample_issues: {
      soft_duplicates: dupSample,
      missing_contact: missingSampleRaw.map((r) => ({
        trn: r.trn,
        name: r.name,
        missing: [r.email == null && "email", r.phone == null && "phone"].filter(
          Boolean,
        ) as string[],
        segment: r.segment,
        industry: r.industry,
        last_filing_date: r.last_filing_date,
        vat_registered: r.vat_registered === true,
        ct_registered: r.ct_registered === true,
      })),
      dormant_active_mismatch: dormantSample.map((r) => ({
        trn: r.trn,
        name: r.name,
        last_filing_date: r.last_filing_date,
        segment: r.segment,
        industry: r.industry,
        vat_registered: r.vat_registered === true,
        ct_registered: r.ct_registered === true,
        registration_date: r.registration_date,
      })),
    },
    fta_anchors: anchors,
    period_assessed: "2025-12-31 snapshot",
  };
}

// =========================================================================
//   POA 4 — On-Time Filing
// =========================================================================

export interface FilingAggregations {
  filing_rates: Record<string, {
    expected: number;
    on_time: number;
    late: number;
    not_filed: number;
    rate_all_pct: number;
    rate_large_pct: number;
  }>;
  e_filing_rate_pct_overall: number;
  e_filing_rate_pct_by_tax: Record<string, number>;
  non_filer_worklist: {
    total_cases: number;
    by_tax_type: Record<string, number>;
    highest_value_aed: number;
    total_aed_outstanding: number;
    sample_cases: Array<{
      declaration_id: string;
      trn: string;
      legal_name_en: string;
      tax_type: string;
      period_label: string;
      due_date: string;
      days_overdue: number;
      tax_due: number;
      industry: string;
      segment: string;
    }>;
  };
  p4_14_management_practices: {
    predictive_modelling_used: boolean;
    automated_identification: boolean;
    auto_penalties: boolean;
    documented_procedures: boolean;
    follow_up_within_days: number;
    register_routinely_updated: boolean;
  };
  period_assessed: string;
}

export async function aggregateFiling(): Promise<FilingAggregations> {
  const taxTypes = ["CT", "VAT", "EXCISE"] as const;
  const filingRates: FilingAggregations["filing_rates"] = {};

  for (const t of taxTypes) {
    const overall = (await one<{
      expected: string;
      on_time: string;
      late: string;
      not_filed: string;
    }>(`
      SELECT
        COUNT(*)::text                                                    AS expected,
        COALESCE(SUM(CASE WHEN status='Filed' AND is_late=FALSE THEN 1 ELSE 0 END), 0)::text  AS on_time,
        COALESCE(SUM(CASE WHEN status='Filed' AND is_late=TRUE  THEN 1 ELSE 0 END), 0)::text  AS late,
        COALESCE(SUM(CASE WHEN status='NotFiled' THEN 1 ELSE 0 END), 0)::text               AS not_filed
      FROM declarations WHERE tax_type=$1
    `, [t]))!;

    const large = (await one<{ expected: string; on_time: string }>(`
      SELECT
        COUNT(*)::text                                                                       AS expected,
        COALESCE(SUM(CASE WHEN d.status='Filed' AND d.is_late=FALSE THEN 1 ELSE 0 END), 0)::text AS on_time
      FROM declarations d
      JOIN taxpayers tp ON tp.trn = d.trn
      WHERE d.tax_type=$1 AND tp.segment='Large'
    `, [t]))!;

    const expected = Number(overall.expected);
    const onTime = Number(overall.on_time);
    const largeExp = Number(large.expected);
    const largeOnTime = Number(large.on_time);
    filingRates[t] = {
      expected,
      on_time: onTime,
      late: Number(overall.late),
      not_filed: Number(overall.not_filed),
      rate_all_pct: expected ? (onTime / expected) * 100 : 0,
      rate_large_pct: largeExp ? (largeOnTime / largeExp) * 100 : 0,
    };
  }

  const eFiling = await one<{ rate: string | null }>(`
    SELECT
      (100.0 * SUM(CASE WHEN is_electronic=TRUE AND status='Filed' THEN 1 ELSE 0 END) /
       NULLIF(SUM(CASE WHEN status='Filed' THEN 1 ELSE 0 END), 0))::text AS rate
    FROM declarations
  `);

  const eFilingByTax = Object.fromEntries(
    (await many<{ tax_type: string; rate: string | null }>(`
      SELECT tax_type,
        (100.0 * SUM(CASE WHEN is_electronic=TRUE AND status='Filed' THEN 1 ELSE 0 END) /
         NULLIF(SUM(CASE WHEN status='Filed' THEN 1 ELSE 0 END), 0))::text AS rate
      FROM declarations GROUP BY tax_type
    `)).map((r) => [r.tax_type, r.rate == null ? 0 : Number(r.rate)]),
  );

  const nonFilerByTax = Object.fromEntries(
    (await many<{ tax_type: string; c: string }>(`
      SELECT tax_type, COUNT(*)::text AS c FROM declarations
      WHERE status='NotFiled' GROUP BY tax_type
    `)).map((r) => [r.tax_type, Number(r.c)]),
  );
  const nonFilerTotal = Object.values(nonFilerByTax).reduce(
    (a, b) => a + (b as number),
    0,
  );
  const nonFilerTotals = (await one<{ highest: string; total: string }>(`
    SELECT COALESCE(MAX(declared_tax_due), 0)::text AS highest,
           COALESCE(SUM(declared_tax_due), 0)::text AS total
    FROM declarations WHERE status='NotFiled'
  `))!;

  const nonFilerSample = await many<{
    declaration_id: string;
    trn: string;
    legal_name_en: string;
    tax_type: string;
    period_end: string;
    due_date: string;
    days_overdue: number;
    tax_due: string;
    industry: string;
    segment: string;
  }>(`
    SELECT
      d.declaration_id,
      d.trn,
      tp.legal_name_en,
      d.tax_type,
      to_char(d.period_end, 'YYYY-MM-DD')                              AS period_end,
      to_char(d.statutory_due_date, 'YYYY-MM-DD')                      AS due_date,
      (CURRENT_DATE - d.statutory_due_date)::int                       AS days_overdue,
      d.declared_tax_due::text                                          AS tax_due,
      tp.industry                                                      AS industry,
      tp.segment                                                       AS segment
    FROM declarations d
    JOIN taxpayers tp ON tp.trn = d.trn
    WHERE d.status='NotFiled'
    ORDER BY d.declared_tax_due DESC
    LIMIT 25
  `);

  const labelPeriod = (taxType: string, periodEnd: string): string => {
    const d = new Date(periodEnd);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    if (taxType === "CT") return `FY${y}`;
    if (taxType === "VAT") {
      const q = Math.ceil(m / 3);
      return `${y}-Q${q}`;
    }
    // EXCISE — monthly
    return `${y}-M${String(m).padStart(2, "0")}`;
  };

  const enrichedSample = nonFilerSample.map((r) => ({
    declaration_id: r.declaration_id,
    trn: r.trn,
    legal_name_en: r.legal_name_en,
    tax_type: r.tax_type,
    period_label: labelPeriod(r.tax_type, r.period_end),
    due_date: r.due_date,
    days_overdue: Math.max(0, Number(r.days_overdue)),
    tax_due: Number(r.tax_due),
    industry: r.industry,
    segment: r.segment,
  }));

  return {
    filing_rates: filingRates,
    e_filing_rate_pct_overall: eFiling?.rate == null ? 0 : Number(eFiling.rate),
    e_filing_rate_pct_by_tax: eFilingByTax,
    non_filer_worklist: {
      total_cases: nonFilerTotal,
      by_tax_type: nonFilerByTax,
      highest_value_aed: Number(nonFilerTotals.highest),
      total_aed_outstanding: Number(nonFilerTotals.total),
      sample_cases: enrichedSample,
    },
    // For the POC these reflect what's actually implemented in our seed.
    // In a real assessment these come from interviews + system inspection.
    p4_14_management_practices: {
      predictive_modelling_used: false,
      automated_identification: true,
      auto_penalties: true,
      documented_procedures: true,
      follow_up_within_days: 14,
      register_routinely_updated: true,
    },
    period_assessed: "FY2025 — 12 months VAT/Excise + CT FY2024 (due Sep 2025)",
  };
}

// =========================================================================
//   POA 5 — Payments & Arrears
// =========================================================================

export interface PaymentsAggregations {
  p5_16_e_payment: {
    by_value_pct_overall: number;
    by_value_pct_by_tax: Record<string, number>;
    by_value_pct_large: number;
  };
  p5_18: {
    vat_on_time_by_number_pct: number;
    vat_on_time_by_value_pct: number;
    vat_on_time_large_by_number_pct: number;
    vat_on_time_large_by_value_pct: number;
  };
  p5_19_3yr_avg: {
    total_arrears_to_collections_pct: number;
    collectible_arrears_to_collections_pct: number;
    over_12mo_to_total_arrears_pct: number;
    raw_yearly_breakdown: Array<{ fiscal_year: number; total_pct: number; collectible_pct: number; old_pct: number }>;
  };
  high_risk_debtors: Array<{
    trn: string;
    legal_name_en: string;
    tax_type: string;
    outstanding_aed: number;
    age_bucket: string;
    collectible: boolean;
  }>;
  period_assessed: string;
}

export async function aggregatePayments(): Promise<PaymentsAggregations> {
  // P5-16
  const ePayOverallRow = await one<{ r: string | null }>(`
    SELECT (100.0 * SUM(CASE WHEN is_electronic=TRUE THEN amount_aed ELSE 0 END) /
            NULLIF(SUM(amount_aed),0))::text AS r FROM payments
  `);
  const ePayOverall = ePayOverallRow?.r == null ? 0 : Number(ePayOverallRow.r);

  const ePayByTax = Object.fromEntries(
    (await many<{ tax_type: string; r: string | null }>(`
      SELECT tax_type,
        (100.0 * SUM(CASE WHEN is_electronic=TRUE THEN amount_aed ELSE 0 END) /
         NULLIF(SUM(amount_aed),0))::text AS r
      FROM payments GROUP BY tax_type
    `)).map((x) => [x.tax_type, x.r == null ? 0 : Number(x.r)]),
  );

  const ePayLargeRow = await one<{ r: string | null }>(`
    SELECT (100.0 * SUM(CASE WHEN p.is_electronic=TRUE THEN p.amount_aed ELSE 0 END) /
            NULLIF(SUM(p.amount_aed),0))::text AS r
    FROM payments p JOIN taxpayers tp ON tp.trn = p.trn
    WHERE tp.segment='Large'
  `);
  const ePayLarge = ePayLargeRow?.r == null ? 0 : Number(ePayLargeRow.r);

  // P5-18
  const vatPay = (await one<{
    total_n: string;
    on_time_n: string;
    total_v: string;
    on_time_v: string;
  }>(`
    SELECT
      COUNT(*)::text                                                                AS total_n,
      COALESCE(SUM(CASE WHEN is_late=FALSE THEN 1 ELSE 0 END), 0)::text              AS on_time_n,
      COALESCE(SUM(amount_aed), 0)::text                                             AS total_v,
      COALESCE(SUM(CASE WHEN is_late=FALSE THEN amount_aed ELSE 0 END), 0)::text     AS on_time_v
    FROM payments WHERE tax_type='VAT'
  `))!;

  const vatPayLarge = (await one<{
    total_n: string;
    on_time_n: string;
    total_v: string;
    on_time_v: string;
  }>(`
    SELECT
      COUNT(*)::text                                                                    AS total_n,
      COALESCE(SUM(CASE WHEN p.is_late=FALSE THEN 1 ELSE 0 END), 0)::text                AS on_time_n,
      COALESCE(SUM(p.amount_aed), 0)::text                                               AS total_v,
      COALESCE(SUM(CASE WHEN p.is_late=FALSE THEN p.amount_aed ELSE 0 END), 0)::text     AS on_time_v
    FROM payments p JOIN taxpayers tp ON tp.trn = p.trn
    WHERE p.tax_type='VAT' AND tp.segment='Large'
  `))!;

  const vatTotalN = Number(vatPay.total_n);
  const vatOnTimeN = Number(vatPay.on_time_n);
  const vatTotalV = Number(vatPay.total_v);
  const vatOnTimeV = Number(vatPay.on_time_v);
  const vatLargeTotalN = Number(vatPayLarge.total_n);
  const vatLargeOnTimeN = Number(vatPayLarge.on_time_n);
  const vatLargeTotalV = Number(vatPayLarge.total_v);
  const vatLargeOnTimeV = Number(vatPayLarge.on_time_v);

  // P5-19
  const yearlyRaw = await many<{
    fiscal_year: number;
    total_pct: string | null;
    collectible_pct: string | null;
    old_pct: string | null;
  }>(`
    SELECT fiscal_year,
           (100.0 * SUM(total_arrears_eoy_aed) / NULLIF(SUM(total_collected_aed),0))::text   AS total_pct,
           (100.0 * SUM(collectible_arrears_eoy_aed) / NULLIF(SUM(total_collected_aed),0))::text AS collectible_pct,
           (100.0 * SUM(arrears_over_12mo_eoy_aed) / NULLIF(SUM(total_arrears_eoy_aed),0))::text AS old_pct
    FROM collections_summary GROUP BY fiscal_year ORDER BY fiscal_year DESC
  `);
  const yearly = yearlyRaw.map((r) => ({
    fiscal_year: Number(r.fiscal_year),
    total_pct: r.total_pct == null ? 0 : Number(r.total_pct),
    collectible_pct: r.collectible_pct == null ? 0 : Number(r.collectible_pct),
    old_pct: r.old_pct == null ? 0 : Number(r.old_pct),
  }));

  const avg = (key: "total_pct" | "collectible_pct" | "old_pct") =>
    yearly.length ? yearly.reduce((s, r) => s + (r[key] ?? 0), 0) / yearly.length : 0;

  // High-risk debtors: largest outstanding overall
  const debtors = await many<{
    trn: string;
    legal_name_en: string;
    tax_type: string;
    outstanding_aed: string;
    age_bucket: string;
    collectible_flag: boolean;
  }>(`
    SELECT a.trn, tp.legal_name_en, a.tax_type,
           a.outstanding_total_aed::text AS outstanding_aed,
           a.age_bucket, a.collectible_flag
    FROM arrears_ledger a JOIN taxpayers tp ON tp.trn = a.trn
    ORDER BY a.outstanding_total_aed DESC LIMIT 10
  `);

  return {
    p5_16_e_payment: {
      by_value_pct_overall: ePayOverall,
      by_value_pct_by_tax: ePayByTax,
      by_value_pct_large: ePayLarge,
    },
    p5_18: {
      vat_on_time_by_number_pct: vatTotalN ? (vatOnTimeN / vatTotalN) * 100 : 0,
      vat_on_time_by_value_pct: vatTotalV ? (vatOnTimeV / vatTotalV) * 100 : 0,
      vat_on_time_large_by_number_pct: vatLargeTotalN ? (vatLargeOnTimeN / vatLargeTotalN) * 100 : 0,
      vat_on_time_large_by_value_pct: vatLargeTotalV ? (vatLargeOnTimeV / vatLargeTotalV) * 100 : 0,
    },
    p5_19_3yr_avg: {
      total_arrears_to_collections_pct: avg("total_pct"),
      collectible_arrears_to_collections_pct: avg("collectible_pct"),
      over_12mo_to_total_arrears_pct: avg("old_pct"),
      raw_yearly_breakdown: yearly,
    },
    high_risk_debtors: debtors.map((d) => ({
      trn: d.trn,
      legal_name_en: d.legal_name_en,
      tax_type: d.tax_type,
      outstanding_aed: Number(d.outstanding_aed),
      age_bucket: d.age_bucket,
      collectible: d.collectible_flag === true,
    })),
    period_assessed: "FY2023–2025 (3-year average per P5-19 methodology)",
  };
}

// =========================================================================
//   POA 2 — Effective Risk Management
// =========================================================================
//
// The aggregator does no SQL of its own — it leans on aggregateRegistry /
// aggregateFiling / aggregatePayments and derives risk signals from the
// quantitative outputs. Qualitative governance fields are synthesized at
// realistic UAE-FTA values and clearly labelled as such; the LLM uses them
// to score P2-3 → P2-7 against the field guide rubric.
//
// Risk register output is hybrid:
//   • data-derived  — computed from POA 1/4/5 thresholds (always shown)
//   • tadat-illustrative — drawn from field guide POA 2 background, gated
//                          by a UI toggle so reviewers can opt in
//   • fta-internal — reserved for when FTA connects their real register

export interface RiskSignal {
  risk_id: string;
  name: string;
  segment:
    | "Individuals"
    | "Micro-Small"
    | "Medium"
    | "Large"
    | "HNWI"
    | "Non-profit"
    | "Government"
    | "Cross-cutting";
  tax_type: "VAT" | "CIT" | "Excise" | "PIT" | "Cross-cutting";
  likelihood_hint: "Low" | "Medium" | "High";
  impact_hint: "Low" | "Medium" | "High";
  source: "data-derived" | "tadat-illustrative" | "fta-internal";
  supporting_evidence: string[];
  tadat_dimension_hints: string[];
  estimated_aed_at_risk: number | null;
  confidence_hint: "Low" | "Medium" | "High";
}

export interface RiskMgmtAggregations {
  data_derived: {
    registry: {
      total_taxpayers: number;
      duplicate_pairs: number;
      missing_contact: number;
      dormant_active_mismatch: number;
    };
    filing: {
      vat_on_time_pct: number;
      ct_on_time_pct: number;
      excise_on_time_pct: number;
      large_taxpayer_vat_pct: number;
      non_filer_count: number;
      non_filer_aed_total: number;
    };
    payments: {
      vat_on_time_by_value_pct: number;
      total_arrears_3yr_pct: number;
      collectible_arrears_3yr_pct: number;
      old_arrears_3yr_pct: number;
      e_payment_pct: number;
      total_arrears_aed: number;
    };
  };
  risk_signals: RiskSignal[];
  governance: {
    intelligence_gathering: {
      sources_used: string[];
      cadence: string;
      uses_advanced_analytics: boolean;
      notes: string;
    };
    risk_assessment_process: {
      structured: boolean;
      multi_year_strategy: boolean;
      core_taxes_covered: string[];
      sectors_ranked: string[];
      tax_gap_studied_for: string[];
      notes: string;
    };
    compliance_improvement_plan: {
      exists: boolean;
      covers_taxes: string[];
      covers_segments: string[];
      implemented_pct: number;
      notes: string;
    };
    monitoring_evaluation: {
      risk_committee_cadence: string;
      reports_published_cadence: string;
      independent_evaluation: string;
      notes: string;
    };
    operational_risk_program: {
      risk_register_exists: boolean;
      bia_completed: boolean;
      bcp_areas_covered: number;
      training_completion_pct: number;
      training_tested: boolean;
      notes: string;
    };
    business_continuity_plan: {
      approved: boolean;
      last_full_test_months_ago: number;
      monitoring_cadence: string;
      notes: string;
    };
    human_capital_strategy: {
      hr_strategy_exists: boolean;
      hcr_register_exists: boolean;
      performance_review_cadence: string;
      annual_review_coverage_pct: number;
      manager_hcr_training: boolean;
      notes: string;
    };
    hcr_evaluation: {
      independent_review: boolean;
      annual_evaluation: boolean;
      published_in_annual_report: boolean;
      notes: string;
    };
  };
  period_start: string;
  period_end: string;
  sources: string[];
}

export async function aggregateRiskMgmt(): Promise<RiskMgmtAggregations> {
  // Derive quantitative signals from the existing POA 1/4/5 aggregators.
  const [reg, fil, pay] = await Promise.all([
    aggregateRegistry(),
    aggregateFiling(),
    aggregatePayments(),
  ]);

  const dataDerived = {
    registry: {
      total_taxpayers: reg.registry_stats.total_records,
      duplicate_pairs: reg.registry_stats.soft_duplicate_pairs_count,
      missing_contact: reg.registry_stats.missing_either_contact_count,
      dormant_active_mismatch:
        reg.registry_stats.active_with_no_recent_filing_count,
    },
    filing: {
      vat_on_time_pct: fil.filing_rates.VAT?.rate_all_pct ?? 0,
      ct_on_time_pct: fil.filing_rates.CT?.rate_all_pct ?? 0,
      excise_on_time_pct: fil.filing_rates.EXCISE?.rate_all_pct ?? 0,
      large_taxpayer_vat_pct: fil.filing_rates.VAT?.rate_large_pct ?? 0,
      non_filer_count: fil.non_filer_worklist.total_cases,
      non_filer_aed_total: fil.non_filer_worklist.total_aed_outstanding,
    },
    payments: {
      vat_on_time_by_value_pct: pay.p5_18.vat_on_time_by_value_pct,
      total_arrears_3yr_pct:
        pay.p5_19_3yr_avg.total_arrears_to_collections_pct,
      collectible_arrears_3yr_pct:
        pay.p5_19_3yr_avg.collectible_arrears_to_collections_pct,
      old_arrears_3yr_pct: pay.p5_19_3yr_avg.over_12mo_to_total_arrears_pct,
      e_payment_pct: pay.p5_16_e_payment.by_value_pct_overall,
      total_arrears_aed: pay.high_risk_debtors.reduce(
        (s, d) => s + d.outstanding_aed,
        0
      ),
    },
  };

  // ── Data-derived risks (computed from above) ───────────────────────────
  const REFUND_VEHICLE_AED = 500_000;
  const data_derived_risks: RiskSignal[] = [];

  if (dataDerived.registry.duplicate_pairs >= 10) {
    data_derived_risks.push({
      risk_id: "DD-REG-01",
      name: "VAT refund fraud via duplicate / soft-duplicate registrations",
      segment: "Cross-cutting",
      tax_type: "VAT",
      likelihood_hint: "High",
      impact_hint: "High",
      source: "data-derived",
      supporting_evidence: [
        `${dataDerived.registry.duplicate_pairs} suspect duplicate registrations in registry`,
        `Estimated exposure ≈ AED ${(
          (dataDerived.registry.duplicate_pairs * REFUND_VEHICLE_AED) /
          1_000_000
        ).toFixed(1)}M (industry-typical refund vehicle)`,
      ],
      tadat_dimension_hints: ["P2-3-1", "P2-3-2", "P2-4-1"],
      estimated_aed_at_risk:
        dataDerived.registry.duplicate_pairs * REFUND_VEHICLE_AED,
      confidence_hint: "Medium",
    });
  }

  if (dataDerived.registry.missing_contact >= 30) {
    data_derived_risks.push({
      risk_id: "DD-REG-02",
      name: "Enforcement gap: registrants unreachable for filing / payment notices",
      segment: "Cross-cutting",
      tax_type: "Cross-cutting",
      likelihood_hint: "Medium",
      impact_hint: "Medium",
      source: "data-derived",
      supporting_evidence: [
        `${dataDerived.registry.missing_contact} active records without email or phone`,
      ],
      tadat_dimension_hints: ["P2-3-2", "P2-4-1"],
      estimated_aed_at_risk: null,
      confidence_hint: "High",
    });
  }

  if (dataDerived.filing.ct_on_time_pct < 90) {
    data_derived_risks.push({
      risk_id: "DD-FIL-01",
      name: "Corporate Tax filing compliance below TADAT-A threshold",
      segment: "Large",
      tax_type: "CIT",
      likelihood_hint: "High",
      impact_hint: "High",
      source: "data-derived",
      supporting_evidence: [
        `CT on-time filing rate ${dataDerived.filing.ct_on_time_pct.toFixed(1)}% (TADAT-A ≥ 90%)`,
        `${dataDerived.filing.non_filer_count} non-filers; AED ${(
          dataDerived.filing.non_filer_aed_total / 1_000_000
        ).toFixed(1)}M outstanding`,
      ],
      tadat_dimension_hints: ["P2-3-2", "P2-4-1", "P2-5-1"],
      estimated_aed_at_risk: dataDerived.filing.non_filer_aed_total,
      confidence_hint: "High",
    });
  }

  if (dataDerived.payments.total_arrears_3yr_pct > 10) {
    data_derived_risks.push({
      risk_id: "DD-PAY-01",
      name: "Arrears stock above TADAT-A threshold (3-year average)",
      segment: "Cross-cutting",
      tax_type: "Cross-cutting",
      likelihood_hint: "High",
      impact_hint:
        dataDerived.payments.total_arrears_3yr_pct > 20 ? "High" : "Medium",
      source: "data-derived",
      supporting_evidence: [
        `Total arrears / collections (3-yr avg) = ${dataDerived.payments.total_arrears_3yr_pct.toFixed(1)}%`,
        `Old arrears (>12 months) share = ${dataDerived.payments.old_arrears_3yr_pct.toFixed(1)}%`,
      ],
      tadat_dimension_hints: ["P2-3-2", "P2-4-1"],
      estimated_aed_at_risk: dataDerived.payments.total_arrears_aed,
      confidence_hint: "High",
    });
  }

  if (dataDerived.payments.e_payment_pct < 75) {
    data_derived_risks.push({
      risk_id: "DD-PAY-02",
      name: "Cash / non-electronic payment risk (P5-16 below TADAT-A)",
      segment: "Micro-Small",
      tax_type: "Cross-cutting",
      likelihood_hint: "Medium",
      impact_hint: "Medium",
      source: "data-derived",
      supporting_evidence: [
        `Electronic payment share (by value) = ${dataDerived.payments.e_payment_pct.toFixed(1)}%`,
      ],
      tadat_dimension_hints: ["P2-3-2", "P2-4-1"],
      estimated_aed_at_risk: null,
      confidence_hint: "High",
    });
  }

  // ── TADAT-illustrative risks (Field Guide Ch IV pg 41–43) ─────────────
  // Sourced from the field guide's "Good practice in compliance risk
  // management → Research on topical compliance issues internationally".
  // UI toggles whether these display.
  const tadat_illustrative_risks: RiskSignal[] = [
    {
      risk_id: "TI-01",
      name: "Transfer pricing & profit shifting by multinational enterprises",
      segment: "Large",
      tax_type: "CIT",
      likelihood_hint: "High",
      impact_hint: "High",
      source: "tadat-illustrative",
      supporting_evidence: [
        "Field Guide Ch IV pg 42: cross-border profit shifting cited as topical compliance issue",
        "UAE introduced CT in 2023; large MNEs newly in scope",
      ],
      tadat_dimension_hints: ["P2-3-1", "P2-3-2", "P2-4-1"],
      estimated_aed_at_risk: null,
      confidence_hint: "Low",
    },
    {
      risk_id: "TI-02",
      name: "Hidden economy — cash transactions and falsified records",
      segment: "Micro-Small",
      tax_type: "Cross-cutting",
      likelihood_hint: "High",
      impact_hint: "Medium",
      source: "tadat-illustrative",
      supporting_evidence: [
        "Field Guide Ch IV pg 42: hidden economic activity called out as a research priority",
      ],
      tadat_dimension_hints: ["P2-3-1", "P2-3-2"],
      estimated_aed_at_risk: null,
      confidence_hint: "Low",
    },
    {
      risk_id: "TI-03",
      name: "Refund fraud (VAT and income tax)",
      segment: "Cross-cutting",
      tax_type: "VAT",
      likelihood_hint: "High",
      impact_hint: "High",
      source: "tadat-illustrative",
      supporting_evidence: [
        "Field Guide Ch IV pg 42 + Ch III pg 25: registration is the entry point for refund fraud",
      ],
      tadat_dimension_hints: ["P2-3-1", "P2-3-2", "P2-4-1"],
      estimated_aed_at_risk: null,
      confidence_hint: "Low",
    },
    {
      risk_id: "TI-04",
      name: "Aggressive tax planning by HNWI / high-income individuals",
      segment: "HNWI",
      tax_type: "CIT",
      likelihood_hint: "Medium",
      impact_hint: "High",
      source: "tadat-illustrative",
      supporting_evidence: [
        "Field Guide Ch IV pg 42: HNWI aggressive planning highlighted",
      ],
      tadat_dimension_hints: ["P2-3-1", "P2-3-2"],
      estimated_aed_at_risk: null,
      confidence_hint: "Low",
    },
    {
      risk_id: "TI-05",
      name: "Crypto-asset evasion",
      segment: "Individuals",
      tax_type: "CIT",
      likelihood_hint: "Medium",
      impact_hint: "Medium",
      source: "tadat-illustrative",
      supporting_evidence: [
        "Field Guide Ch IV pg 42: 'use of crypto assets to evade tax'",
      ],
      tadat_dimension_hints: ["P2-3-1"],
      estimated_aed_at_risk: null,
      confidence_hint: "Low",
    },
  ];

  // ── Governance qualitative signals (synthesized at realistic UAE values) ─
  // Deliberately mixes A-eligible and B-eligible practices so the LLM
  // produces a non-trivial score distribution.
  const governance: RiskMgmtAggregations["governance"] = {
    intelligence_gathering: {
      sources_used: [
        "Tax administration audit results",
        "UAE Federal Customs Authority data",
        "Banking sector via FATCA / CRS exchange",
        "Real estate cadastre",
        "Media monitoring",
      ],
      cadence: "Quarterly environmental scan; annual compliance gap study (VAT)",
      uses_advanced_analytics: false,
      notes:
        "Predictive modelling and machine learning are piloted but not routinely embedded in case selection.",
    },
    risk_assessment_process: {
      structured: true,
      multi_year_strategy: true,
      core_taxes_covered: ["VAT", "CIT", "Excise"],
      sectors_ranked: ["Construction", "Real Estate", "Wholesale & Retail Trade"],
      tax_gap_studied_for: ["VAT"],
      notes:
        "Annual risk-rating matrix exercise produces likelihood × impact scores; CT not yet gap-studied.",
    },
    compliance_improvement_plan: {
      exists: true,
      covers_taxes: ["VAT", "CIT", "Excise"],
      covers_segments: ["Large", "Medium", "Small", "Micro"],
      implemented_pct: 72,
      notes:
        "CIP brings together all top-rated risks; resourced and partially implemented within FY2025.",
    },
    monitoring_evaluation: {
      risk_committee_cadence: "Monthly",
      reports_published_cadence: "Quarterly",
      independent_evaluation: "Annual external review",
      notes:
        "Effectiveness reports inform the next CIP cycle; revenue-impact quantified for top mitigations.",
    },
    operational_risk_program: {
      risk_register_exists: true,
      bia_completed: true,
      bcp_areas_covered: 3,
      training_completion_pct: 89,
      training_tested: true,
      notes:
        "Operational risk register reviewed annually; BIA covers IT, natural disasters, and human-made events.",
    },
    business_continuity_plan: {
      approved: true,
      last_full_test_months_ago: 8,
      monitoring_cadence: "Quarterly",
      notes:
        "Senior leadership endorses the strategy and tracks implementation; full simulation conducted within last 12 months.",
    },
    human_capital_strategy: {
      hr_strategy_exists: true,
      hcr_register_exists: true,
      performance_review_cadence: "Twice yearly",
      annual_review_coverage_pct: 95,
      manager_hcr_training: true,
      notes:
        "HR strategy in place; HCR risks tracked across capability/capacity/compliance/cost/connection categories.",
    },
    hcr_evaluation: {
      independent_review: false,
      annual_evaluation: true,
      published_in_annual_report: true,
      notes:
        "HCR status evaluated annually by HR; independent third-party evaluation not yet established.",
    },
  };

  return {
    data_derived: dataDerived,
    risk_signals: [...data_derived_risks, ...tadat_illustrative_risks],
    governance,
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    sources: [
      "POA 1 outputs (registry stats)",
      "POA 4 outputs (filing rates, non-filer worklist)",
      "POA 5 outputs (arrears, e-payment)",
      "TADAT 2025 Field Guide Chapter IV",
      "FTA Enterprise Risk Management Policy (referenced)",
    ],
  };
}

// =========================================================================
//   POA 3 — Supporting and Facilitating Compliance
// =========================================================================
//
// Service-channel KPIs derive from FTA's open-data publications and a
// realistic UAE-FTA configuration. Where the open-data dump provides
// volumes (inquiries, complaints, TRC requests, tax-agent counts) we cite
// them; where it doesn't (call wait time, abandon rate, satisfaction
// scores) we synthesize at realistic mid-band values so the LLM produces
// a defensible TADAT score and an actionable "make-it-easier" backlog.

export interface FacilitationAggregations {
  service_channels: {
    telephone: {
      monthly_calls: number;
      median_wait_minutes: number;
      pct_answered_within_6min: number;     // P3-9-1 proxy
      abandon_rate_pct: number;
      satisfaction_score_1to5: number;
      service_standard_documented: boolean;
      reported_monthly: boolean;
    };
    written: {
      avg_response_days: number;
      service_standard_documented: boolean;
      reported_monthly: boolean;
    };
    email: {
      avg_response_days: number;
      service_standard_documented: boolean;
    };
    in_person: {
      walk_in_centers: number;
      avg_wait_minutes: number;
      service_standard_documented: boolean;
    };
    online_chat: {
      enabled: boolean;
      service_standard_documented: boolean;
    };
    social_media: {
      channels: string[];
      service_standard_documented: boolean;
    };
  };
  information_products: {
    languages_supported: string[];
    formats: string[];                      // guides, brochures, FAQs, rulings, etc.
    tailored_for_segments: string[];        // P3-8-1
    update_procedures_documented: boolean;
    last_updated_months_ago: number;        // P3-8-2
    digitally_excluded_provision: boolean;  // P3-8-3
    public_rulings_published: boolean;      // P3-12
    private_rulings_offered: boolean;
    cooperative_compliance_in_place: boolean; // P3-12 A criterion
  };
  inquiry_and_complaint_volumes: {
    inquiries_per_year: number;             // from open-data 2024
    complaints_per_year: number;            // from open-data 2024
    tax_clarification_requests_per_year: number;
    administrative_exception_requests_per_year: number;
    trc_requests_per_year: number;
    reconsideration_requests_per_year: number;
  };
  intermediary_engagement: {
    registered_tax_agents: number;          // from open-data total tax agents
    by_emirate: Record<string, number>;
    annual_consultation_meetings: number;
  };
  cost_reduction_initiatives: {              // P3-10
    simplified_recordkeeping_for_small: boolean;
    pre_filled_vat_returns: boolean;
    pre_filled_ct_returns: boolean;
    nil_declaration_quick_path: boolean;
    online_taxpayer_portal_24_7: boolean;
    e_invoicing_integration: boolean;
    forms_reviewed_annually: boolean;
    notes: string;
  };
  feedback_and_design: {                     // P3-11
    perception_survey_cadence: string;       // "Every 3 years (independent)"
    independent_third_party: boolean;
    public_results_published: boolean;
    user_testing_in_design: boolean;
    consultation_meetings_per_year: number;
  };
  // Inputs lifted from POA 4 / 5 to ground the agent in real adoption rates
  digital_adoption: {
    e_filing_pct_overall: number;
    e_payment_pct_overall: number;
  };
  period_start: string;
  period_end: string;
  sources: string[];
}

export async function aggregateFacilitation(): Promise<FacilitationAggregations> {
  // Real adoption rates from POA 4 / 5
  const [fil, pay] = await Promise.all([aggregateFiling(), aggregatePayments()]);

  return {
    service_channels: {
      telephone: {
        monthly_calls: 50_000,                  // contact center (synth, realistic UAE FTA)
        median_wait_minutes: 7.4,
        pct_answered_within_6min: 58.0,         // proxy for P3-9-1 — between TADAT B (60%) and C (50%)
        abandon_rate_pct: 12.5,
        satisfaction_score_1to5: 4.1,
        service_standard_documented: true,
        reported_monthly: true,
      },
      written: {
        avg_response_days: 5.2,
        service_standard_documented: true,
        reported_monthly: true,
      },
      email: {
        avg_response_days: 3.1,
        service_standard_documented: true,
      },
      in_person: {
        walk_in_centers: 7,                     // Tas'heel + FTA service points
        avg_wait_minutes: 11.8,
        service_standard_documented: false,
      },
      online_chat: {
        enabled: true,                          // EmaraTax platform supports chat
        service_standard_documented: false,
      },
      social_media: {
        channels: ["X / Twitter", "LinkedIn", "Instagram"],
        service_standard_documented: false,
      },
    },
    information_products: {
      languages_supported: ["English", "Arabic"],
      formats: [
        "Guides",
        "User manuals",
        "Public clarifications",
        "Cabinet decisions",
        "FAQs",
        "Video tutorials",
        "Tax agent program materials",
      ],
      tailored_for_segments: [
        "Large taxpayers",
        "SMEs",
        "Free-zone businesses",
        "Tax agents",
      ],
      update_procedures_documented: true,
      last_updated_months_ago: 1,
      digitally_excluded_provision: true,        // walk-in + Tas'heel centres
      public_rulings_published: true,
      private_rulings_offered: true,
      cooperative_compliance_in_place: false,    // not yet rolled out at scale → keeps P3-12 below A
    },
    inquiry_and_complaint_volumes: {
      inquiries_per_year: 459_697,                // FTA open data 2024
      complaints_per_year: 76_795,                // FTA open data 2024
      tax_clarification_requests_per_year: 11_204,
      administrative_exception_requests_per_year: 3_812,
      trc_requests_per_year: 18_603,
      reconsideration_requests_per_year: 4_376,   // FTA open data 2024
    },
    intermediary_engagement: {
      registered_tax_agents: 783,                 // approx UAE tax-agent registry
      by_emirate: {
        Dubai: 522,
        "Abu Dhabi": 158,
        Sharjah: 51,
        Ajman: 23,
        "Ras Al Khaimah": 14,
        Fujairah: 9,
        "Umm Al Quwain": 6,
      },
      annual_consultation_meetings: 6,
    },
    cost_reduction_initiatives: {
      simplified_recordkeeping_for_small: false,  // UAE has not formalised SME simplified regime
      pre_filled_vat_returns: false,
      pre_filled_ct_returns: false,
      nil_declaration_quick_path: true,
      online_taxpayer_portal_24_7: true,          // EmaraTax
      e_invoicing_integration: false,             // mandate forthcoming, not yet in production
      forms_reviewed_annually: true,
      notes:
        "EmaraTax taxpayer portal is the primary self-service channel; e-invoicing mandate announced for phase-in 2026.",
    },
    feedback_and_design: {
      perception_survey_cadence: "Every 3 years (last 2024, independent)",
      independent_third_party: true,
      public_results_published: true,
      user_testing_in_design: true,
      consultation_meetings_per_year: 6,
    },
    digital_adoption: {
      e_filing_pct_overall: fil.e_filing_rate_pct_overall,
      e_payment_pct_overall: pay.p5_16_e_payment.by_value_pct_overall,
    },
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    sources: [
      "FTA Open Data 2024 (inquiries, complaints, reconsiderations)",
      "FTA Tax Agents register",
      "EmaraTax platform (channel inventory)",
      "POA 4 / 5 outputs (e-filing, e-payment adoption)",
      "TADAT 2025 Field Guide Chapter V",
    ],
  };
}
