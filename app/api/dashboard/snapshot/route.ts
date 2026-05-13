/**
 * GET /api/dashboard/snapshot
 *
 * One-shot endpoint that returns everything the dashboard needs:
 *   - Top-line KPIs (taxpayers, declarations, payments, arrears)
 *   - Per-POA pre-aggregated data
 *   - Real FTA aggregate anchors for comparison
 *
 * Pure SQL — no LLM. Used by the dashboard for visualizations.
 */
import { NextResponse } from "next/server";
import { one, many } from "@/lib/db";
import {
  aggregateRegistry,
  aggregateFiling,
  aggregatePayments,
} from "@/lib/tadat/aggregations";

export async function GET() {
  // ── Top-line KPIs ─────────────────────────────────────────────────────
  const [
    taxpayersRow,
    activeRow,
    declRow,
    paymentsRow,
    collectedRow,
    arrearsRow,
    arrearsCountRow,
    nonFilersRow,
  ] = await Promise.all([
    one<{ c: string }>(`SELECT COUNT(*)::text AS c FROM taxpayers`),
    one<{ c: string }>(`SELECT COUNT(*)::text AS c FROM taxpayers WHERE status='Active'`),
    one<{ c: string }>(`SELECT COUNT(*)::text AS c FROM declarations`),
    one<{ c: string }>(`SELECT COUNT(*)::text AS c FROM payments`),
    one<{ s: string }>(`SELECT COALESCE(SUM(amount_aed), 0)::text AS s FROM payments`),
    one<{ s: string }>(`SELECT COALESCE(SUM(outstanding_total_aed), 0)::text AS s FROM arrears_ledger`),
    one<{ c: string }>(`SELECT COUNT(*)::text AS c FROM arrears_ledger`),
    one<{ c: string }>(`SELECT COUNT(*)::text AS c FROM declarations WHERE status='NotFiled'`),
  ]);

  // ── Per-POA aggregations (run in parallel) ────────────────────────────
  const [poa1, poa4, poa5] = await Promise.all([
    aggregateRegistry(),
    aggregateFiling(),
    aggregatePayments(),
  ]);

  // ── Real FTA anchors + distributions ──────────────────────────────────
  const [ftaAnchors, arrearsByBucket, byEmirate, bySegment, filingTrend] =
    await Promise.all([
      many(
        `SELECT fiscal_year, metric, value::text AS value, source_file
         FROM fta_aggregates
         ORDER BY fiscal_year DESC, metric`,
      ),
      many(`
        SELECT age_bucket,
               COUNT(*)::int AS cases,
               ROUND(SUM(outstanding_total_aed)::numeric, 2)::text AS amount_aed
        FROM arrears_ledger
        GROUP BY age_bucket
        ORDER BY CASE age_bucket
          WHEN '0-30' THEN 1 WHEN '31-90' THEN 2 WHEN '91-365' THEN 3 ELSE 4 END
      `),
      many(
        `SELECT emirate, COUNT(*)::int AS count
         FROM taxpayers
         GROUP BY emirate
         ORDER BY count DESC`,
      ),
      many(`
        SELECT segment, COUNT(*)::int AS count
        FROM taxpayers
        GROUP BY segment
        ORDER BY CASE segment
          WHEN 'Large' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Small' THEN 3 ELSE 4 END
      `),
      many(`
        SELECT
          to_char(period_end, 'YYYY-MM') AS month,
          tax_type,
          COUNT(*)::int AS expected,
          COALESCE(SUM(CASE WHEN status='Filed' AND is_late=FALSE THEN 1 ELSE 0 END), 0)::int AS on_time
        FROM declarations
        WHERE tax_type IN ('VAT','EXCISE')
        GROUP BY month, tax_type
        ORDER BY month
      `),
    ]);

  return NextResponse.json({
    success: true,
    generated_at: new Date().toISOString(),
    kpis: {
      taxpayers: Number(taxpayersRow?.c ?? 0),
      active_taxpayers: Number(activeRow?.c ?? 0),
      declarations: Number(declRow?.c ?? 0),
      payments: Number(paymentsRow?.c ?? 0),
      total_collected_aed: Number(collectedRow?.s ?? 0),
      total_arrears_aed: Number(arrearsRow?.s ?? 0),
      arrears_cases: Number(arrearsCountRow?.c ?? 0),
      non_filer_cases: Number(nonFilersRow?.c ?? 0),
    },
    distributions: {
      by_emirate: byEmirate,
      by_segment: bySegment,
      arrears_by_bucket: arrearsByBucket.map((r) => ({
        age_bucket: (r as { age_bucket: string }).age_bucket,
        cases: (r as { cases: number }).cases,
        amount_aed: Number((r as { amount_aed: string }).amount_aed),
      })),
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
