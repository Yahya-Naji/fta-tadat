/**
 * GET /api/dashboard/snapshot
 *
 * One-shot endpoint that returns everything the dashboard needs:
 *   - Top-line KPIs (taxpayers, declarations, payments, arrears)
 *   - Per-POA pre-aggregated data
 *   - Real FTA aggregate anchors for comparison
 *
 * Pure SQL — no LLM. Fast. Used by the dashboard for visualizations.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  aggregateRegistry,
  aggregateFiling,
  aggregatePayments,
} from "@/lib/tadat/aggregations";

export async function GET() {
  const db = getDb();

  // ── Top-line KPIs ───────────────────────────────────────────────────────
  const taxpayers = (db.prepare(`SELECT COUNT(*) AS c FROM taxpayers`).get() as { c: number }).c;
  const activeTaxpayers = (db.prepare(`SELECT COUNT(*) AS c FROM taxpayers WHERE status='Active'`).get() as { c: number }).c;
  const declarations = (db.prepare(`SELECT COUNT(*) AS c FROM declarations`).get() as { c: number }).c;
  const payments = (db.prepare(`SELECT COUNT(*) AS c FROM payments`).get() as { c: number }).c;
  const totalCollected = (db.prepare(`SELECT COALESCE(SUM(amount_aed), 0) AS s FROM payments`).get() as { s: number }).s;
  const totalArrears = (db.prepare(`SELECT COALESCE(SUM(outstanding_total_aed), 0) AS s FROM arrears_ledger`).get() as { s: number }).s;
  const arrearsCount = (db.prepare(`SELECT COUNT(*) AS c FROM arrears_ledger`).get() as { c: number }).c;
  const nonFilers = (db.prepare(`SELECT COUNT(*) AS c FROM declarations WHERE status='NotFiled'`).get() as { c: number }).c;

  // ── Aggregations per POA (the same ones agents will receive) ───────────
  const poa1 = aggregateRegistry();
  const poa4 = aggregateFiling();
  const poa5 = aggregatePayments();

  // ── Real FTA anchors for the comparison panel ──────────────────────────
  const ftaAnchors = db
    .prepare(`SELECT fiscal_year, metric, value, source_file FROM fta_aggregates ORDER BY fiscal_year DESC, metric`)
    .all();

  // ── Arrears aging breakdown for the heat strip ─────────────────────────
  const arrearsByBucket = db.prepare(`
    SELECT age_bucket,
           COUNT(*) AS cases,
           ROUND(SUM(outstanding_total_aed), 2) AS amount_aed
    FROM arrears_ledger
    GROUP BY age_bucket
    ORDER BY CASE age_bucket
      WHEN '0-30' THEN 1 WHEN '31-90' THEN 2 WHEN '91-365' THEN 3 ELSE 4 END
  `).all();

  // ── Taxpayer distribution by emirate (for donut) ───────────────────────
  const byEmirate = db.prepare(`
    SELECT emirate, COUNT(*) AS count FROM taxpayers GROUP BY emirate ORDER BY count DESC
  `).all();
  const bySegment = db.prepare(`
    SELECT segment, COUNT(*) AS count FROM taxpayers GROUP BY segment ORDER BY
      CASE segment WHEN 'Large' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Small' THEN 3 ELSE 4 END
  `).all();

  // ── Monthly filing trend (12 months VAT) for sparklines ────────────────
  const filingTrend = db.prepare(`
    SELECT
      strftime('%Y-%m', period_end) AS month,
      tax_type,
      COUNT(*) AS expected,
      SUM(CASE WHEN status='Filed' AND is_late=0 THEN 1 ELSE 0 END) AS on_time
    FROM declarations
    WHERE tax_type IN ('VAT','EXCISE')
    GROUP BY month, tax_type
    ORDER BY month
  `).all();

  return NextResponse.json({
    success: true,
    generated_at: new Date().toISOString(),
    kpis: {
      taxpayers,
      active_taxpayers: activeTaxpayers,
      declarations,
      payments,
      total_collected_aed: totalCollected,
      total_arrears_aed: totalArrears,
      arrears_cases: arrearsCount,
      non_filer_cases: nonFilers,
    },
    distributions: {
      by_emirate: byEmirate,
      by_segment: bySegment,
      arrears_by_bucket: arrearsByBucket,
      filing_trend_monthly: filingTrend,
    },
    poa1: {
      registry_stats: poa1.registry_stats,
      sample_issues_counts: {
        soft_duplicates: poa1.sample_issues.soft_duplicates.length,
        missing_contact: poa1.sample_issues.missing_contact.length,
        dormant_active_mismatch: poa1.sample_issues.dormant_active_mismatch.length,
      },
    },
    poa4: {
      filing_rates: poa4.filing_rates,
      e_filing_rate_pct_overall: poa4.e_filing_rate_pct_overall,
      e_filing_rate_pct_by_tax: poa4.e_filing_rate_pct_by_tax,
      non_filer_total: poa4.non_filer_worklist.total_cases,
      non_filer_by_tax: poa4.non_filer_worklist.by_tax_type,
    },
    poa5: {
      e_payment_pct: poa5.p5_16_e_payment.by_value_pct_overall,
      vat_on_time_pct_n: poa5.p5_18.vat_on_time_by_number_pct,
      vat_on_time_pct_v: poa5.p5_18.vat_on_time_by_value_pct,
      arrears_total_pct: poa5.p5_19_3yr_avg.total_arrears_to_collections_pct,
      arrears_old_pct: poa5.p5_19_3yr_avg.over_12mo_to_total_arrears_pct,
      yearly_breakdown: poa5.p5_19_3yr_avg.raw_yearly_breakdown,
      high_risk_debtors: poa5.high_risk_debtors,
    },
    fta_anchors: ftaAnchors,
  });
}
