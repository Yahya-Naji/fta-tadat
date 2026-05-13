import { getDb } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DataPage() {
  const db = getDb();
  const tables = ["taxpayers", "declarations", "payments", "arrears_ledger", "collections_summary", "fta_aggregates"];
  const stats = tables.map((t) => {
    const c = (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
    return { table: t, count: c };
  });

  // Sample of real FTA anchors to surface
  const ftaSample = db
    .prepare(`SELECT fiscal_year, metric, value FROM fta_aggregates ORDER BY fiscal_year DESC, metric LIMIT 12`)
    .all() as Array<{ fiscal_year: number; metric: string; value: number }>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20 dark:border-indigo-500/30">
        ← Back
      </Link>

      <h1 className="mb-8 text-3xl font-bold gradient-text">Database snapshot</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-gray-400">
          Table counts
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {stats.map((s) => (
            <div key={s.table} className="glass-panel p-4">
              <div className="text-[11px] font-mono uppercase text-gray-500">{s.table}</div>
              <div className="text-2xl font-bold text-white">{s.count.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-gray-400">
          Sample real FTA anchors (from{" "}
          <a
            href="https://tax.gov.ae/en/open.data/open.data.aspx"
            target="_blank"
            rel="noreferrer"
            className="text-fta hover:underline"
          >
            tax.gov.ae
          </a>
          )
        </h2>
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-[11px] uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Year</th>
                <th className="px-4 py-2 text-left">Metric</th>
                <th className="px-4 py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {ftaSample.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="px-4 py-2 font-mono text-gray-400">{r.fiscal_year}</td>
                  <td className="px-4 py-2 text-gray-300">{r.metric}</td>
                  <td className="px-4 py-2 text-right font-mono text-white">
                    {r.value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
