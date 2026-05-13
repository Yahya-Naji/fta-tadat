/**
 * Best-effort parser for arbitrary FTA Excel/CSV/JSON uploads.
 *
 * Strategy — keep this generic because the 30+ FTA open-data xlsx files
 * have wildly different shapes (pivot tables, year×month grids, lists of
 * cases, etc.). We:
 *
 *   • Iterate every sheet
 *   • Pull headers + the first ~12 rows as a representative sample
 *   • Detect numeric columns and compute totals
 *   • Try to find a "year" / "period" column to expose period coverage
 *   • Surface ~4 headline figures (row count, biggest numeric total, etc.)
 *
 * Output shape mirrors the existing `SampleInputPreview` UI type so the
 * UploadStudio can render the parsed file identically to a packaged
 * sample — but driven by real data this time.
 */
import * as XLSX from "xlsx";

export interface ParsedSection {
  label: string;
  rows: number;
  summary: string;
  columns: string[];
  /** Up to 12 rows, each as a flat array of stringified cell values (matches
   *  the UploadStudio SampleInputPreview shape). */
  sample_rows: Array<Array<string | number>>;
}

export interface ParsedFile {
  filename: string;
  /** Detected period from any year/date columns, if discoverable. */
  period?: { start: string; end: string };
  source: string;
  sections: ParsedSection[];
  headlines: Array<{ label: string; value: string }>;
}

const MAX_SAMPLE_ROWS = 12;

export function parseBufferToFile(
  buffer: ArrayBuffer | Buffer,
  filename: string,
): ParsedFile {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "json") {
    return parseJsonBuffer(buffer, filename);
  }
  // .xlsx, .xls, .csv — SheetJS reads them all the same way
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return parseWorkbook(wb, filename);
}

function parseWorkbook(wb: XLSX.WorkBook, filename: string): ParsedFile {
  const sections: ParsedSection[] = [];
  let totalNumericMax = 0;
  let totalNumericLabel = "";
  let earliestYear: number | null = null;
  let latestYear: number | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });
    if (json.length === 0) continue;

    const columns = Object.keys(json[0]).slice(0, 8); // cap visible cols
    const sampleRows = json.slice(0, MAX_SAMPLE_ROWS).map((row) =>
      columns.map((c) => formatCell(row[c])),
    );
    const summary = describeSheet(columns, json.length);

    sections.push({
      label: sheetName.replace(/_/g, " ").replace(/^\s+|\s+$/g, "") || `Sheet ${sections.length + 1}`,
      rows: json.length,
      summary,
      columns,
      sample_rows: sampleRows,
    });

    // Detect numeric totals across the sheet for headline figures
    for (const col of columns) {
      let total = 0;
      let anyNumeric = false;
      for (const row of json) {
        const v = row[col];
        if (typeof v === "number" && Number.isFinite(v)) {
          total += v;
          anyNumeric = true;
        }
      }
      if (anyNumeric && total > totalNumericMax) {
        totalNumericMax = total;
        totalNumericLabel = `${sheetName} · ${col}`;
      }
    }

    // Year detection — look at any column whose name contains "year" or "date"
    for (const col of columns) {
      const lc = col.toLowerCase();
      if (lc.includes("year") || lc.includes("date") || lc === "period") {
        for (const row of json) {
          const v = row[col];
          const year =
            typeof v === "number" && v >= 1900 && v <= 2100
              ? v
              : typeof v === "string"
                ? extractYear(v)
                : v instanceof Date
                  ? v.getFullYear()
                  : null;
          if (year != null) {
            earliestYear = earliestYear == null ? year : Math.min(earliestYear, year);
            latestYear = latestYear == null ? year : Math.max(latestYear, year);
          }
        }
      }
    }
  }

  const totalRows = sections.reduce((s, x) => s + x.rows, 0);
  const headlines: Array<{ label: string; value: string }> = [
    { label: "Sheets", value: String(sections.length) },
    { label: "Total rows", value: totalRows.toLocaleString() },
  ];
  if (totalNumericMax > 0) {
    headlines.push({
      label: truncate(totalNumericLabel, 22),
      value: formatNumber(totalNumericMax),
    });
  }
  if (earliestYear != null && latestYear != null) {
    headlines.push({
      label: "Period covered",
      value: earliestYear === latestYear ? String(earliestYear) : `${earliestYear} → ${latestYear}`,
    });
  }

  return {
    filename,
    period:
      earliestYear != null && latestYear != null
        ? { start: `${earliestYear}-01-01`, end: `${latestYear}-12-31` }
        : undefined,
    source: "uploaded by user",
    sections,
    headlines,
  };
}

function parseJsonBuffer(buffer: ArrayBuffer | Buffer, filename: string): ParsedFile {
  const text = Buffer.from(buffer as ArrayBuffer).toString("utf-8");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return {
      filename,
      source: "uploaded by user",
      sections: [],
      headlines: [{ label: "Status", value: "Invalid JSON" }],
    };
  }
  const sections: ParsedSection[] = [];
  // If it's an object whose values are arrays, treat each key as a section
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        const rows = value as Array<Record<string, unknown>>;
        const columns = Object.keys(rows[0]).slice(0, 8);
        sections.push({
          label: key,
          rows: rows.length,
          summary: describeSheet(columns, rows.length),
          columns,
          sample_rows: rows.slice(0, MAX_SAMPLE_ROWS).map((row) =>
            columns.map((c) => formatCell(row[c])),
          ),
        });
      }
    }
  } else if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    const rows = data as Array<Record<string, unknown>>;
    const columns = Object.keys(rows[0]).slice(0, 8);
    sections.push({
      label: "rows",
      rows: rows.length,
      summary: describeSheet(columns, rows.length),
      columns,
      sample_rows: rows.slice(0, MAX_SAMPLE_ROWS).map((row) =>
        columns.map((c) => formatCell(row[c])),
      ),
    });
  }
  const totalRows = sections.reduce((s, x) => s + x.rows, 0);
  return {
    filename,
    source: "uploaded by user",
    sections,
    headlines: [
      { label: "Sections", value: String(sections.length) },
      { label: "Total rows", value: totalRows.toLocaleString() },
    ],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function describeSheet(columns: string[], rows: number): string {
  if (columns.length === 0) return `${rows} rows`;
  const preview = columns.slice(0, 4).join(" · ");
  return `${preview}${columns.length > 4 ? ` (+${columns.length - 4} more)` : ""}`;
}

function formatCell(v: unknown): string | number {
  if (v == null) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v;
    return Number(v.toFixed(2));
  }
  const s = String(v);
  return s.length > 60 ? s.slice(0, 59) + "…" : s;
}

function extractYear(s: string): number | null {
  const m = s.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
