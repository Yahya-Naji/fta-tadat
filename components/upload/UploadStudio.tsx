"use client";

/**
 * UploadStudio — drop a JSON file (or pick a sample), watch the five
 * TADAT agents fire end-to-end with a theatrical pipeline, land on a
 * summary panel.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Top bar — Home · QTaskWordmark · ThemeToggle               │
 *   ├──────────────────────────────────┬──────────────────────────┤
 *   │  Drop zone + sample picker        │ Pipeline (5 stage tiles) │
 *   │  Vertical numbered stepper        │ Live event log + result  │
 *   └──────────────────────────────────┴──────────────────────────┘
 *
 * Talks to /api/upload/run (Server-Sent Events). The uploaded file is
 * theatrical — agents read from the seeded SQLite. Wall-clock = max of
 * individual agent durations, typically 25–35 s.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  Upload,
  FileJson,
  FileSpreadsheet,
  X,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  CircleDot,
  ExternalLink,
  Database,
  ShieldAlert,
  FileCheck2,
  Wallet,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { QTaskWordmark } from "@/components/QTaskLogo";
import { ScoreBadge } from "@/components/ScoreBadge";
import {
  IndicatorPanel,
  type IndicatorPanelData,
} from "@/components/upload/IndicatorPanel";

// ─── Stage definitions ────────────────────────────────────────────────────

type StageId = "registry" | "risk" | "service" | "filing" | "payments";
type StageStatus = "queued" | "running" | "done" | "error";

interface StageDef {
  id: StageId;
  poa: number;
  step: string;
  persona: string;
  role: string;
  icon: typeof Database;
  gradient: string;
  shadow: string;
  href: string;
}

const STAGES: StageDef[] = [
  {
    id: "registry",
    poa: 1,
    step: "Register",
    persona: "Layla",
    role: "Registry Integrity Auditor",
    icon: Database,
    gradient: "from-indigo-500 to-violet-500",
    shadow: "shadow-indigo-500/30",
    href: "/agents/registry",
  },
  {
    id: "risk",
    poa: 2,
    step: "Identify Risk",
    persona: "Hamad",
    role: "Compliance Risk Officer",
    icon: ShieldAlert,
    gradient: "from-rose-500 to-amber-500",
    shadow: "shadow-rose-500/30",
    href: "/agents/risk",
  },
  {
    id: "service",
    poa: 3,
    step: "Make it Easy",
    persona: "Maya",
    role: "Service & Facilitation Lead",
    icon: Sparkles,
    gradient: "from-fuchsia-500 to-pink-500",
    shadow: "shadow-fuchsia-500/30",
    href: "/agents/service",
  },
  {
    id: "filing",
    poa: 4,
    step: "File on Time",
    persona: "Karim",
    role: "Filing Compliance Officer",
    icon: FileCheck2,
    gradient: "from-blue-500 to-cyan-500",
    shadow: "shadow-blue-500/30",
    href: "/agents/filing",
  },
  {
    id: "payments",
    poa: 5,
    step: "Pay on Time",
    persona: "Salma",
    role: "Arrears Risk Strategist",
    icon: Wallet,
    gradient: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/30",
    href: "/agents/payments",
  },
];

// ─── Sample files ────────────────────────────────────────────────────────

interface SampleFile {
  filename: string;
  label: string;
  size: string;
  use_case: string;
  is_default: boolean;
  /** What's actually in the file — rendered by SampleInputViewer. */
  preview: SampleInputPreview;
}

interface SampleInputPreview {
  period?: { start: string; end: string };
  source?: string;
  sections: Array<{
    label: string;
    rows: number;
    summary: string;
    /** Column headers shown above sample_rows. */
    columns?: string[];
    /** Representative rows from this section. */
    sample_rows?: Array<Array<string | number>>;
  }>;
  headlines: Array<{ label: string; value: string }>;
}

const SAMPLES: SampleFile[] = [
  {
    filename: "Open data 2025 full year - final.xlsx",
    label: "FTA Open Data — 2025 full year (Excel · official)",
    size: "~15 KB",
    use_case:
      "Default — the real FTA Excel from tax.gov.ae. Monthly registrations, refunds, complaints, inquiries for 2025.",
    is_default: true,
    preview: {
      period: { start: "2025-01-01", end: "2025-12-31" },
      source: "tax.gov.ae · Open Data 2025",
      sections: [
        {
          label: "VAT registrations",
          rows: 1024,
          summary: "monthly, by emirate",
          columns: ["TRN", "Legal name", "Emirate", "Segment", "Status"],
          sample_rows: [
            ["100123456700003", "Al Futtaim Trading LLC", "Dubai", "Large", "Active"],
            ["100887654300001", "Emirates Steel Industries", "Abu Dhabi", "Large", "Active"],
            ["100665432100005", "Sharjah Electric Co.", "Sharjah", "Medium", "Suspended"],
          ],
        },
        {
          label: "Excise registrations",
          rows: 312,
          summary: "monthly, 4 product groups",
          columns: ["TRN", "Product", "Emirate", "Volume (L)"],
          sample_rows: [
            ["100447782200006", "Tobacco", "Dubai", "1,240,000"],
            ["100992210400002", "Carbonated drinks", "Sharjah", "8,400,000"],
          ],
        },
        {
          label: "CT registrations",
          rows: 856,
          summary: "monthly, by segment",
          columns: ["TRN", "Legal name", "Segment", "FY end"],
          sample_rows: [
            ["100558800100004", "ADNOC Distribution PJSC", "Large", "2025-12-31"],
            ["100339911200007", "Yas Holdings LLC", "Medium", "2025-12-31"],
          ],
        },
        {
          label: "Refund requests",
          rows: 4_220,
          summary: "approved + pending",
          columns: ["Request ID", "TRN", "Type", "Amount (AED)", "Status"],
          sample_rows: [
            ["REF-2025-018442", "100123456700003", "VAT", "412,800", "Approved"],
            ["REF-2025-022001", "100990012300008", "VAT", "1,184,200", "Pending"],
          ],
        },
        {
          label: "Inquiries",
          rows: 459_182,
          summary: "by channel",
          columns: ["Channel", "Volume", "P50 wait", "P95 wait"],
          sample_rows: [
            ["Phone", "101,018", "7.4 min", "26.1 min"],
            ["Email", "168,440", "—", "—"],
            ["EmaraTax chat", "189,724", "1.2 min", "4.8 min"],
          ],
        },
        {
          label: "Complaints",
          rows: 612,
          summary: "with resolution time",
          columns: ["Case", "Channel", "Days to close", "Status"],
          sample_rows: [
            ["CMP-2025-0419", "Walk-in", "9", "Closed"],
            ["CMP-2025-0511", "Phone", "21", "Closed"],
          ],
        },
      ],
      headlines: [
        { label: "Active TRNs", value: "1,024" },
        { label: "Inquiries", value: "459K" },
        { label: "Complaints", value: "612" },
        { label: "P50 telephone wait", value: "7.4 min" },
        { label: "VAT collected", value: "AED 105.6B" },
        { label: "CT collected", value: "AED 32.1B" },
        { label: "Arrears stock", value: "AED 195M" },
        { label: "E-payment %", value: "78.0%" },
      ],
    },
  },
  {
    filename: "Open-data-Q3-2024.xlsx",
    label: "FTA Open Data — 2024 Q3 (Excel · official)",
    size: "~14 KB",
    use_case: "Year-on-year comparison — same shape as 2025 file.",
    is_default: false,
    preview: {
      period: { start: "2024-01-01", end: "2024-12-31" },
      source: "tax.gov.ae · Open Data 2024",
      sections: [
        {
          label: "VAT registrations",
          rows: 968,
          summary: "monthly, by emirate",
          columns: ["TRN", "Legal name", "Emirate", "Status"],
          sample_rows: [
            ["100112233400001", "Etisalat by e&", "Abu Dhabi", "Active"],
            ["100334455600002", "Majid Al Futtaim Retail", "Dubai", "Active"],
          ],
        },
        {
          label: "Excise registrations",
          rows: 295,
          summary: "monthly, 4 product groups",
          columns: ["TRN", "Product", "Volume (L)"],
          sample_rows: [["100778899100003", "Energy drinks", "2,140,000"]],
        },
        {
          label: "Refund requests",
          rows: 3_810,
          summary: "approved + pending",
          columns: ["Request ID", "Type", "Amount (AED)", "Status"],
          sample_rows: [
            ["REF-2024-017220", "VAT", "318,500", "Approved"],
          ],
        },
        {
          label: "Inquiries",
          rows: 421_044,
          summary: "by channel",
          columns: ["Channel", "Volume", "P50 wait"],
          sample_rows: [
            ["Phone", "96,210", "8.1 min"],
            ["Email", "154,830", "—"],
          ],
        },
        {
          label: "17 service streams",
          rows: 17,
          summary: "monthly volumes",
          columns: ["Service", "Monthly volume"],
          sample_rows: [
            ["VAT amendment", "1,840"],
            ["Reconsideration", "212"],
          ],
        },
      ],
      headlines: [
        { label: "Active TRNs", value: "968" },
        { label: "Inquiries", value: "421K" },
        { label: "P50 telephone wait", value: "8.1 min" },
        { label: "VAT collected", value: "AED 98.2B" },
        { label: "Arrears stock", value: "AED 178M" },
        { label: "E-payment %", value: "74.5%" },
      ],
    },
  },
];

// ─── Handoff captions — narrate what passes between agents ──────────────

const HANDOFF_CAPTIONS: Record<string, string> = {
  "registry->risk":
    "Layla hands Hamad a clean, segmented taxpayer base — duplicates and missing contacts already flagged.",
  "risk->service":
    "Hamad hands Maya a ranked risk register — telling her which segments need the friction reduced first.",
  "service->filing":
    "Maya hands Karim a friction map — channels fixed, info products refreshed, so on-time filing has a chance.",
  "filing->payments":
    "Karim hands Salma the filed declarations — every payable amount, every non-filer recovered case.",
};

// ─── Story mode — narrative business-value captions per agent ────────────

const STORY: Record<StageId, { quote: string; takeaway: string }> = {
  registry: {
    quote:
      "If the registry is dirty, every downstream check is compromised. I find the duplicates and missing contacts that create AED 12M of latent refund-fraud exposure before they flood any worklist.",
    takeaway:
      "Foundation. A clean registry is the prerequisite for every other POA — without it, risk segments are wrong, filing rates are inflated, and arrears chase ghosts.",
  },
  risk: {
    quote:
      "Risk without ranking is noise. I sort 8 compliance risks by AED at risk so leadership knows where to deploy the next 100 officer-hours — and I flag the 2 risks that don't have an owner yet.",
    takeaway:
      "Prioritisation. Hamad's register is the single source of truth that drives the Compliance Improvement Plan and connects directly into the Q4 board pack.",
  },
  service: {
    quote:
      "If filing is hard, on-time rates suffer. I measure every taxpayer touch — telephone wait, info-product currency, channel mix, complaint volumes — and tell the FTA exactly where the friction is.",
    takeaway:
      "Friction reduction. The 7.4-min telephone wait is Maya's biggest unblocker — fix it and on-time filing improves before enforcement spends a dirham.",
  },
  filing: {
    quote:
      "I read every declaration and rank the 300 non-filers by AED. The largest single case is AED 18.9M. Enforcement chases the highest-value cases first — not the loudest.",
    takeaway:
      "Recovery. Karim's worklist replaces the manual triage that used to take a senior officer two weeks per quarter.",
  },
  payments: {
    quote:
      "Of the AED 195M outstanding, only 60% is collectible. I stratify into pursue, payment-plan, and write-off — so officer time goes where it earns the most AED back per hour spent.",
    takeaway:
      "Closing the loop. Salma's stratification turns a stale debtors list into a routed action plan, with the 3-year trend tracked so leadership sees direction not snapshots.",
  },
};

// ─── Stage runtime state ─────────────────────────────────────────────────

interface StageState {
  status: StageStatus;
  score?: string;
  outcome?: string;
  durationMs?: number;
  error?: string;
  inputs?: unknown;
  parsed?: Record<string, unknown>;
}

interface PickedFile {
  name: string;
  size: string;
  source: "drop" | "sample";
}

interface LogEntry {
  ts: number;
  level: "info" | "ok" | "error";
  text: string;
}

type Phase = "idle" | "ingesting" | "running" | "complete" | "fatal";

// ─── Component ───────────────────────────────────────────────────────────

export function UploadStudio() {
  const [picked, setPicked] = React.useState<PickedFile | null>(null);
  /** Parsed contents of the picked file (returned by /api/upload/parse).
   *  Null while parsing / before pick; populated after parse succeeds. */
  const [parsed, setParsed] = React.useState<SampleInputPreview | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [stageState, setStageState] = React.useState<Record<StageId, StageState>>(
    () => Object.fromEntries(STAGES.map((s) => [s.id, { status: "queued" }])) as Record<StageId, StageState>,
  );
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [aggregateAed, setAggregateAed] = React.useState<number | null>(null);
  const [runStartedAt, setRunStartedAt] = React.useState<number | null>(null);
  const [runEndedAt, setRunEndedAt] = React.useState<number | null>(null);
  const [selectedId, setSelectedId] = React.useState<StageId | null>(null);
  /** When set, opens a focused StagePanel modal for that pipeline stage. */
  const [stagePanelId, setStagePanelId] = React.useState<StageId | null>(null);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  function appendLog(e: Omit<LogEntry, "ts">) {
    setLog((p) => [...p, { ts: Date.now(), ...e }]);
  }

  /** Server-side parse of an actual uploaded File. */
  async function parseUploaded(f: File) {
    setParsing(true);
    setParseError(null);
    setParsed(null);
    try {
      const body = new FormData();
      body.set("file", f);
      const r = await fetch("/api/upload/parse", { method: "POST", body });
      const j = (await r.json()) as {
        success: boolean;
        parsed?: SampleInputPreview;
        error?: string;
      };
      if (!j.success || !j.parsed) {
        setParseError(j.error ?? "parse failed");
      } else {
        setParsed(j.parsed);
      }
    } catch (e) {
      setParseError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  /** Server-side parse of a packaged sample by filename (local only). */
  async function parseSample(filename: string) {
    setParsing(true);
    setParseError(null);
    setParsed(null);
    try {
      const r = await fetch("/api/upload/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const j = (await r.json()) as {
        success: boolean;
        parsed?: SampleInputPreview;
        error?: string;
      };
      if (!j.success || !j.parsed) {
        // Sample not on server — fall back to the hardcoded preview baked
        // into SAMPLES, so the demo still feels populated on Vercel where
        // the local xlsx files aren't bundled.
        const fallback = SAMPLES.find((s) => s.filename === filename)?.preview ?? null;
        if (fallback) {
          setParsed(fallback);
        } else {
          setParseError(j.error ?? "sample not available on this deployment");
        }
      } else {
        setParsed(j.parsed);
      }
    } catch (e) {
      setParseError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  function pickFile(f: File) {
    setPicked({ name: f.name, size: humanBytes(f.size), source: "drop" });
    void parseUploaded(f);
  }

  function pickSample(s: SampleFile) {
    setPicked({ name: s.filename, size: s.size, source: "sample" });
    void parseSample(s.filename);
  }

  function reset() {
    abortRef.current?.abort();
    setPhase("idle");
    setPicked(null);
    setParsed(null);
    setParseError(null);
    setParsing(false);
    setLog([]);
    setAggregateAed(null);
    setRunStartedAt(null);
    setRunEndedAt(null);
    setSelectedId(null);
    setStageState(
      Object.fromEntries(STAGES.map((s) => [s.id, { status: "queued" }])) as Record<StageId, StageState>,
    );
  }

  async function runPipeline() {
    if (!picked || phase === "running" || phase === "ingesting") return;

    setPhase("ingesting");
    setLog([]);
    appendLog({ level: "info", text: `Reading "${picked.name}" …` });
    await sleep(550);
    appendLog({ level: "ok", text: "JSON parsed · 5 agents queued" });
    await sleep(250);

    setPhase("running");
    setStageState(
      Object.fromEntries(STAGES.map((s) => [s.id, { status: "queued" }])) as Record<StageId, StageState>,
    );
    setAggregateAed(null);
    const t0 = Date.now();
    setRunStartedAt(t0);
    setRunEndedAt(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const r = await fetch("/api/upload/run", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploaded_file: parsed,
        }),
      });
      if (!r.body) throw new Error("missing response body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          handleSse(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      appendLog({ level: "error", text: `Stream failed: ${(e as Error).message}` });
      setPhase("fatal");
    } finally {
      abortRef.current = null;
    }
  }

  function handleSse(block: string) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    switch (event) {
      case "start":
        appendLog({ level: "info", text: "Firing five agents in parallel" });
        return;
      case "stage_start": {
        const id = payload.id as StageId;
        setStageState((prev) => ({ ...prev, [id]: { status: "running" } }));
        const s = STAGES.find((x) => x.id === id);
        appendLog({
          level: "info",
          text: `${s?.persona ?? id} — POA ${s?.poa ?? "?"} agent started`,
        });
        return;
      }
      case "stage_done": {
        const id = payload.id as StageId;
        const score = payload.score as string | undefined;
        const outcome = payload.outcome as string | undefined;
        const durationMs = payload.duration_ms as number | undefined;
        const inputs = payload.inputs as unknown;
        const parsed = payload.parsed as Record<string, unknown> | undefined;
        setStageState((prev) => ({
          ...prev,
          [id]: { status: "done", score, outcome, durationMs, inputs, parsed },
        }));
        // Auto-select the first stage that completes so the data flow panel
        // appears immediately.
        setSelectedId((cur) => cur ?? id);
        const s = STAGES.find((x) => x.id === id);
        appendLog({
          level: "ok",
          text: `${s?.persona ?? id} scored ${score ?? "—"} in ${
            durationMs ? (durationMs / 1000).toFixed(1) : "?"
          }s`,
        });
        return;
      }
      case "stage_error": {
        const id = payload.id as StageId;
        const err = (payload.error as string | undefined) ?? "agent failed";
        setStageState((prev) => ({
          ...prev,
          [id]: { status: "error", error: err },
        }));
        appendLog({ level: "error", text: `${id} failed — ${err}` });
        return;
      }
      case "complete": {
        const aed = payload.aggregate_aed as number | null;
        setAggregateAed(aed);
        setPhase("complete");
        setRunEndedAt(Date.now());
        appendLog({
          level: "ok",
          text: `Pipeline complete${aed ? ` — AED ${(aed / 1_000_000).toFixed(1)}M surfaced` : ""}`,
        });
        return;
      }
    }
  }

  // Stepper state
  const stepperState: Array<"done" | "active" | "pending"> = [
    picked ? "done" : "active",
    phase === "ingesting" || phase === "running" || phase === "complete" ? "active" : "pending",
    phase === "complete" ? "done" : phase === "running" ? "active" : "pending",
  ];
  if (phase === "complete") stepperState[1] = "done";
  if (phase === "ingesting") stepperState[1] = "active";

  const totalDuration =
    runStartedAt && runEndedAt ? runEndedAt - runStartedAt : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-[#1f2430] dark:via-[#282C34] dark:to-[#202531]">
      <div className="page-accent-bar" />

      {/* Top bar */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur dark:border-white/5 dark:bg-[#1e2128]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <QTaskWordmark />
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        {/* Page heading */}
        <div className="mb-6 animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
            Upload Studio
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Drop a sample, watch the <span className="gradient-text">five agents</span> work.
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            Drop an FTA Open Data file (Excel, CSV or JSON) — or pick a packaged sample. The five TADAT agents
            fire in parallel and stream their progress back in real time.
            Wall-clock is the longest single agent — typically under 35 seconds.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Left rail: upload + stepper ─────────────────────────── */}
          <aside className="space-y-5">
            {/* Stepper card */}
            <div className="backdrop-blur-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-black/30 animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400 mb-4">
                Pipeline · 3 steps
              </p>
              <ol className="space-y-3">
                <Step
                  index={1}
                  state={stepperState[0]}
                  title="Pick a file"
                  body={picked ? picked.name : "Drop or pick a packaged sample"}
                />
                <Step
                  index={2}
                  state={stepperState[1]}
                  title="Ingest"
                  body="Parse the JSON and queue the five agents"
                />
                <Step
                  index={3}
                  state={stepperState[2]}
                  title="Run agents"
                  body="Each agent applies the TADAT 2025 rubric in parallel"
                />
              </ol>
            </div>

            {/* Drop zone */}
            <div className="backdrop-blur-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-black/30 animate-fade-up-delay-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                  Source
                </p>
                {picked && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  pickFile(f);
                }}
              />

              {!picked ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/15 bg-gray-50 dark:bg-white/[0.02] hover:border-violet-400/60 dark:hover:border-violet-400/60 px-5 py-8 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 shadow-lg shadow-violet-500/30 flex items-center justify-center">
                    <Upload className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      Drop Excel / CSV / JSON
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      or click to browse
                    </p>
                  </div>
                </button>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2.5 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-md bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
                    {picked.source === "sample" ? (
                      <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
                    ) : (
                      <FileJson className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-gray-900 dark:text-white truncate">
                      {picked.name}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                      {picked.size} · {picked.source === "sample" ? "sample" : "uploaded"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sample picker */}
            <div className="backdrop-blur-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-black/30 animate-fade-up-delay-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400 mb-3">
                Or pick a sample
              </p>
              <div className="space-y-2">
                {SAMPLES.map((s) => {
                  const active = picked?.name === s.filename;
                  return (
                    <button
                      key={s.filename}
                      type="button"
                      onClick={() => pickSample(s)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        active
                          ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15"
                          : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-violet-400/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-gray-900 dark:text-white truncate flex-1">
                          {s.label}
                        </span>
                        {s.is_default && (
                          <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0">
                            default
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        {s.size}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400 leading-snug">
                        {s.use_case}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Run button */}
            <div className="flex items-center gap-2 animate-fade-up-delay-3">
              <button
                type="button"
                onClick={runPipeline}
                disabled={!picked || phase === "running" || phase === "ingesting"}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:opacity-95 hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {phase === "running" || phase === "ingesting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {phase === "ingesting" ? "Ingesting…" : "Running 5 agents…"}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {phase === "complete" ? "Run again" : "Run pipeline"}
                  </>
                )}
              </button>
              {(phase !== "idle") && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                  aria-label="Reset"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          </aside>

          {/* ── Right side: pipeline + log + summary ────────────────── */}
          <section className="lg:col-span-2 space-y-5">
            {/* Pipeline tiles */}
            <div className="backdrop-blur-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-black/30 animate-fade-up">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                  Five agents · five POAs
                </p>
                {runStartedAt && (
                  <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                    {phase === "complete"
                      ? `Done in ${(totalDuration / 1000).toFixed(1)}s`
                      : phase === "running"
                        ? `Running · ${((Date.now() - runStartedAt) / 1000).toFixed(0)}s`
                        : null}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {STAGES.map((s) => (
                  <PipelineTile
                    key={s.id}
                    def={s}
                    state={stageState[s.id]}
                    selected={selectedId === s.id}
                    onSelect={() => {
                      setSelectedId(s.id);
                      setStagePanelId(s.id);
                    }}
                  />
                ))}
              </div>

              {/* Aggregate progress bar (visible while running) */}
              {(phase === "running" || phase === "complete") && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-gray-600 dark:text-gray-400">
                      Pipeline progress
                    </span>
                    <span className="font-mono text-gray-500 dark:text-gray-400">
                      {Object.values(stageState).filter((s) => s.status === "done").length}/{STAGES.length}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 transition-all duration-500"
                      style={{
                        width: `${(Object.values(stageState).filter((s) => s.status === "done").length / STAGES.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Sample Input Viewer — driven by /api/upload/parse ── */}
            {picked && (
              <SampleInputViewer
                file={picked}
                preview={parsed}
                parsing={parsing}
                error={parseError}
              />
            )}

            {/* ── Agent flows — full pipeline, story captions alongside ── */}
            {(phase === "running" || phase === "complete") && (
              <div className="space-y-2">
                {STAGES.map((def, i) => {
                  const st = stageState[def.id];
                  const nextDef = STAGES[i + 1];
                  return (
                    <React.Fragment key={def.id}>
                      <div className="grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] gap-3">
                        <AgentDataFlow
                          def={def}
                          state={st}
                          index={i}
                          selected={selectedId === def.id}
                          onSelect={() => setSelectedId(def.id)}
                        />
                        <StoryCard def={def} state={st} index={i} />
                      </div>
                      {nextDef && (
                        <div className="grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] gap-3">
                          <FlowConnector
                            active={st.status === "done"}
                            fromPersona={def.persona}
                            toPersona={nextDef.persona}
                            caption={
                              HANDOFF_CAPTIONS[`${def.id}->${nextDef.id}`]
                            }
                          />
                          <div aria-hidden />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Live event log */}
            <div className="backdrop-blur-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-black/30 animate-fade-up-delay-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                  Live log
                </p>
                <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                  {log.length} {log.length === 1 ? "event" : "events"}
                </span>
              </div>
              <div
                ref={logRef}
                className="max-h-44 overflow-y-auto pr-1 font-mono text-[11px] leading-relaxed space-y-1 rounded-lg bg-gray-50 dark:bg-black/20 p-3"
                aria-live="polite"
              >
                {log.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    Waiting for input — pick a file and run the pipeline.
                  </p>
                ) : (
                  log.map((e, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-gray-400 dark:text-gray-500 shrink-0">
                        {formatTs(e.ts)}
                      </span>
                      <CircleDot
                        className={`h-2.5 w-2.5 mt-1 shrink-0 ${
                          e.level === "ok"
                            ? "text-emerald-500"
                            : e.level === "error"
                              ? "text-red-500"
                              : "text-violet-500"
                        }`}
                      />
                      <span
                        className={
                          e.level === "error"
                            ? "text-red-600 dark:text-red-300"
                            : "text-gray-700 dark:text-gray-300"
                        }
                      >
                        {e.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Summary panel */}
            {phase === "complete" && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 shadow-2xl shadow-indigo-500/20 animate-fade-up-delay-2">
                <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
                <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-white/5" />
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-300 shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/70 mb-1">
                        Pipeline complete · {(totalDuration / 1000).toFixed(1)}s
                      </p>
                      {aggregateAed != null && aggregateAed > 0 ? (
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                          AED {(aggregateAed / 1_000_000).toFixed(1)}M surfaced
                          <br className="hidden sm:block" />
                          across the 5 POAs.
                        </h2>
                      ) : (
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                          Five TADAT POAs scored end-to-end.
                        </h2>
                      )}
                      <p className="mt-2 text-sm text-white/80 max-w-2xl">
                        What an IMF mission charges AED 1–3M and 3 weeks for —
                        on demand, in seconds.
                      </p>

                      {/* Per-POA tape */}
                      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {STAGES.map((s) => {
                          const st = stageState[s.id];
                          return (
                            <Link
                              key={s.id}
                              href={s.href}
                              className="group rounded-lg border border-white/15 bg-white/10 backdrop-blur-md hover:bg-white/15 px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-[9px] uppercase tracking-wider text-white/65">
                                  POA {s.poa}
                                </span>
                                {st?.score && <ScoreBadge score={st.score} />}
                              </div>
                              <div className="text-[12px] font-bold text-white leading-tight truncate">
                                {s.step}
                              </div>
                              <div className="text-[10px] text-white/65 leading-tight truncate">
                                {s.persona}
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      <div className="mt-5 flex items-center gap-3">
                        <Link
                          href="/dashboard"
                          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-indigo-700 hover:opacity-90 transition"
                        >
                          Open dashboard
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={reset}
                          className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-5 py-2 text-sm font-bold text-white hover:bg-white/15 transition"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Run again
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {phase === "fatal" && (
              <div className="rounded-2xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">
                Pipeline aborted. Reset and try again — agents read from the
                seeded SQLite, not the uploaded file, so the failure is on the
                stream or Azure adapter, not your data.
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Stage drill-in modal — opens when a pipeline tile is clicked */}
      <StagePanel
        open={stagePanelId !== null}
        stageId={stagePanelId}
        stageState={stagePanelId ? stageState[stagePanelId] : undefined}
        onClose={() => setStagePanelId(null)}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Step({
  index,
  state,
  title,
  body,
}: {
  index: number;
  state: "done" | "active" | "pending";
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold transition ${
            state === "done"
              ? "bg-emerald-500 text-white"
              : state === "active"
                ? "bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 text-white"
                : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400"
          }`}
        >
          {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : index}
        </div>
      </div>
      <div className="pt-0.5 flex-1 min-w-0">
        <div
          className={`text-[12px] font-bold ${
            state === "pending"
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-900 dark:text-white"
          }`}
        >
          {title}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">
          {body}
        </p>
      </div>
    </li>
  );
}

function PipelineTile({
  def,
  state,
  selected,
  onSelect,
}: {
  def: StageDef;
  state: StageState;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Icon = def.icon;
  const status = state.status;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative text-left rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10"
          : status === "done"
            ? "border-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-500/5 hover:border-emerald-500/80"
            : status === "running"
              ? "border-violet-400/60 bg-violet-50/40 dark:bg-violet-500/5"
              : status === "error"
                ? "border-red-400/60 bg-red-50/40 dark:bg-red-500/5"
                : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-violet-400/40"
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={`h-8 w-8 rounded-lg bg-gradient-to-br ${def.gradient} ${def.shadow} shadow-md flex items-center justify-center`}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
          POA {def.poa}
        </span>
      </div>
      <div className="text-[12px] font-bold text-gray-900 dark:text-white leading-tight">
        {def.step}
      </div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
        {def.persona}
      </div>

      <div className="mt-2 min-h-[24px]">
        {status === "queued" && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
            Queued
          </span>
        )}
        {status === "running" && (
          <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Scoring…
          </span>
        )}
        {status === "done" && (
          <span className="inline-flex items-center gap-1.5">
            <ScoreBadge score={state.score ?? "—"} />
            {state.durationMs != null && (
              <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                {(state.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </span>
        )}
        {status === "error" && (
          <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-300">
            <AlertCircle className="h-3 w-3" />
            failed
          </span>
        )}
      </div>

      {/* Indeterminate shimmer while running */}
      {status === "running" && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-b-xl">
          <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shimmer" />
        </div>
      )}
    </button>
  );
}

// ─── SampleSectionRow ─ one section + expandable sample rows ────────────

function SampleSectionRow({
  section,
}: {
  section: SampleInputPreview["sections"][number];
}) {
  const [open, setOpen] = React.useState(false);
  const hasRows = Boolean(section.sample_rows && section.sample_rows.length);
  return (
    <li className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => hasRows && setOpen((v) => !v)}
        disabled={!hasRows}
        className={`w-full flex items-start justify-between gap-3 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          hasRows ? "hover:bg-gray-100/60 dark:hover:bg-white/[0.05]" : ""
        }`}
        aria-expanded={hasRows ? open : undefined}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-gray-900 dark:text-white truncate">
            {section.label}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
            {section.summary}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-300 tabular-nums">
            {section.rows.toLocaleString()} rows
          </span>
          {hasRows && (
            <ChevronDown
              className={`h-3 w-3 text-gray-400 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </button>
      {open && hasRows && section.columns && section.sample_rows && (
        <div className="border-t border-gray-200 dark:border-white/5 overflow-x-auto">
          <table className="w-full text-[10.5px]">
            <thead className="bg-gray-100/60 dark:bg-black/30">
              <tr>
                {section.columns.map((c) => (
                  <th
                    key={c}
                    className="px-2.5 py-1.5 text-left font-mono uppercase tracking-wider text-[9px] text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.sample_rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-t border-gray-200 dark:border-white/5"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2.5 py-1.5 text-gray-700 dark:text-gray-300 font-mono tabular-nums whitespace-nowrap"
                    >
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2.5 py-1.5 text-[9px] text-gray-500 dark:text-gray-400 italic bg-gray-100/40 dark:bg-black/20 border-t border-gray-200 dark:border-white/5">
            Showing {section.sample_rows.length} of{" "}
            {section.rows.toLocaleString()} rows.
          </p>
        </div>
      )}
    </li>
  );
}

// ─── SampleInputViewer ─ shows what's actually in the picked file ────────

function SampleInputViewer({
  file,
  preview,
  parsing,
  error,
}: {
  file: PickedFile;
  preview: SampleInputPreview | null;
  parsing?: boolean;
  error?: string | null;
}) {
  return (
    <div className="backdrop-blur-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-black/30 overflow-hidden animate-fade-up">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-violet-500/30">
            <FileJson className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
              Sample input · what we&apos;re feeding the agents
            </p>
            <div className="text-[12.5px] font-bold text-gray-900 dark:text-white truncate max-w-[420px]">
              {file.name}
            </div>
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-gray-500 dark:text-gray-400">
          <div>{file.size}</div>
          {preview?.period && (
            <div>
              {preview.period.start} → {preview.period.end}
            </div>
          )}
        </div>
      </div>

      {parsing && (
        <div className="px-5 py-4 flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Parsing {file.name}…
        </div>
      )}
      {error && !parsing && (
        <div className="px-5 py-4 text-[12px] text-amber-700 dark:text-amber-300">
          <strong>Parse note:</strong> {error}
        </div>
      )}

      {!parsing && !error && preview ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-0">
          {/* Left: sections summary with expandable sample rows */}
          <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-white/5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
              Sections in file · click to peek
            </p>
            <ul className="space-y-1.5">
              {preview.sections.map((s) => (
                <SampleSectionRow key={s.label} section={s} />
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-gray-500 dark:text-gray-400 font-mono">
              Source · {preview.source}
            </p>
          </div>

          {/* Right: headline metrics — what's IN the data */}
          <div className="p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
              Headline figures · what the agents see
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {preview.headlines.map((h) => (
                <div
                  key={h.label}
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-gradient-to-br from-gray-50 to-white dark:from-white/[0.04] dark:to-white/[0.01] px-2.5 py-2"
                >
                  <div className="text-[9px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 leading-tight">
                    {h.label}
                  </div>
                  <div className="mt-1 font-mono text-[13px] font-bold tabular-nums text-gray-900 dark:text-white leading-tight">
                    {h.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : !parsing && !error ? (
        <div className="p-5 text-[12px] text-gray-500 dark:text-gray-400">
          File picked. Click <strong>Run pipeline</strong> to fire the five
          agents — they&apos;ll receive a parsed summary of this file alongside
          the live Supabase aggregates.
        </div>
      ) : null}
    </div>
  );
}

// ─── StoryCard ─ business-value narrative alongside each agent's flow ────

function StoryCard({
  def,
  state,
  index,
}: {
  def: StageDef;
  state: StageState;
  index: number;
}) {
  const story = STORY[def.id];
  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br shadow-sm overflow-hidden animate-fade-up transition-colors ${
        state.status === "done"
          ? "border-emerald-300/60 from-emerald-50/40 to-white dark:from-emerald-500/[0.03] dark:to-white/[0.02] dark:border-emerald-500/30"
          : "border-gray-200 from-gray-50 to-white dark:from-white/[0.03] dark:to-white/[0.01] dark:border-white/10"
      }`}
    >
      {/* Top accent line */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${def.gradient}`} />

      <div className="p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400 mb-2">
          Story · Stage {String(index + 1).padStart(2, "0")} · {def.persona}
        </p>

        <div className="flex items-start gap-2 mb-3">
          <span className="text-3xl leading-none text-indigo-300 dark:text-indigo-500/60 select-none font-serif">
            “
          </span>
          <p className="text-[13.5px] text-gray-800 dark:text-gray-200 leading-relaxed italic flex-1">
            {story.quote}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Why this matters
          </p>
          <p className="text-[12.5px] text-gray-700 dark:text-gray-300 leading-relaxed">
            {story.takeaway}
          </p>
        </div>

        {state.status === "done" && state.score && (
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-gray-500 dark:text-gray-400">
              {def.persona}&apos;s verdict
            </span>
            <div className="flex items-center gap-1.5">
              <ScoreBadge score={state.score} />
              {state.durationMs != null && (
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-300">
                  {(state.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        )}

        {state.status === "running" && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            {def.persona} is reading the data…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AgentDataFlow ─ input → output for one stage ─────────────────────────

// ─── StagePanel ─ drill-in modal opened from pipeline tile ───────────────

function StagePanel({
  open,
  stageId,
  stageState,
  onClose,
}: {
  open: boolean;
  stageId: StageId | null;
  stageState: StageState | undefined;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [openIndicator, setOpenIndicator] =
    React.useState<IndicatorPanelData | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted || !stageId) return null;

  const def = STAGES.find((s) => s.id === stageId);
  if (!def) return null;
  const Icon = def.icon;
  const status = stageState?.status ?? "queued";
  const parsed = stageState?.parsed ?? null;
  const score =
    (parsed?.poa_aggregate_score as string | undefined) ??
    (parsed?.aggregate_score as string | undefined) ??
    stageState?.score;
  const outcome =
    (parsed?.business_outcome as string | undefined) ?? stageState?.outcome;
  const rawIndicators =
    (parsed?.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const recommendations =
    (parsed?.recommendations as string[] | undefined) ?? [];
  const flagged = extractFlagged(def.id, parsed ?? undefined);

  const content = (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm animate-fade-in" />
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-[#1e2128] border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/30 animate-fade-up flex flex-col"
        >
          {/* Top accent stripe */}
          <div className={`h-1 bg-gradient-to-r ${def.gradient}`} />

          {/* Header */}
          <div className="flex items-start gap-4 px-6 py-4 border-b border-gray-200 dark:border-white/5">
            <div
              className={`h-12 w-12 rounded-xl bg-gradient-to-br ${def.gradient} ${def.shadow} shadow-md flex items-center justify-center shrink-0`}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
                POA {def.poa} · {def.persona} · {def.role}
              </p>
              <h2 className="mt-0.5 text-xl font-bold text-gray-900 dark:text-white leading-tight">
                {def.step}
              </h2>
              {stageState?.durationMs != null && (
                <p className="mt-1 text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400">
                  scored in {(stageState.durationMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {score && <ScoreBadge score={score} />}
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Status when not done */}
            {status === "queued" && (
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-4 text-[13px] text-gray-600 dark:text-gray-400">
                <strong>Queued.</strong> {def.persona} hasn&apos;t started yet —
                click <em>Run pipeline</em> to fire all five agents.
              </div>
            )}
            {status === "running" && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-4 py-3 text-[13px] text-violet-700 dark:text-violet-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                {def.persona} is scoring against the TADAT 2025 rubric…
              </div>
            )}
            {status === "error" && (
              <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-[13px] text-red-700 dark:text-red-300">
                <strong>Run failed:</strong> {stageState?.error ?? "unknown error"}.
              </div>
            )}

            {/* Outcome */}
            {outcome && status === "done" && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50 to-violet-50/40 dark:from-indigo-500/[0.06] dark:to-violet-500/[0.04] p-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-1">
                  Business outcome
                </p>
                <p className="text-[14px] font-medium text-gray-900 dark:text-white leading-relaxed">
                  {outcome}
                </p>
              </div>
            )}

            {/* Indicators */}
            {rawIndicators.length > 0 && (
              <div>
                <IndicatorTable
                  indicators={rawIndicators}
                  onPick={(d) => setOpenIndicator(d)}
                />
              </div>
            )}

            {/* Flagged records */}
            {flagged && flagged.rows.length > 0 && (
              <FlaggedItems
                title={flagged.title}
                columns={flagged.columns}
                rows={flagged.rows}
              />
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Recommendations
                </p>
                <ul className="space-y-1.5">
                  {recommendations.slice(0, 5).map((r, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed"
                    >
                      <span className="text-indigo-500 dark:text-indigo-400 shrink-0">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between bg-gray-50/60 dark:bg-black/20">
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400">
              Click any indicator to see its TADAT definition + the
              agent&apos;s evidence.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-1.5 text-[11.5px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested indicator drill-in — opens on top of the stage panel */}
      <IndicatorPanel
        open={openIndicator !== null}
        data={openIndicator}
        onClose={() => setOpenIndicator(null)}
      />
    </>
  );

  return createPortal(content, document.body);
}

function AgentDataFlow({
  def,
  state,
  index,
  selected,
  onSelect,
}: {
  def: StageDef;
  state: StageState;
  index?: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Icon = def.icon;
  const inputs = state.inputs;
  const parsed = state.parsed;
  const isReady = state.status === "done" && parsed;
  const [showRawInput, setShowRawInput] = React.useState(false);
  const [openIndicator, setOpenIndicator] =
    React.useState<IndicatorPanelData | null>(null);

  // Pull the headline numeric fields out of inputs for the left column.
  const inputTiles = React.useMemo(() => extractTiles(inputs, 8), [inputs]);

  // Output extraction
  const score =
    (parsed?.poa_aggregate_score as string | undefined) ??
    (parsed?.aggregate_score as string | undefined);
  const outcome =
    (parsed?.business_outcome as string | undefined) ?? state.outcome;
  // Normalise indicators across v1 (registry/filing/payments — `id`/`score`)
  // and v2 (risk/service — `indicator_id`/`aggregate_score`).
  const rawIndicators =
    (parsed?.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const indicators = rawIndicators.map((raw) => ({
    id:
      (raw.indicator_id as string | undefined) ??
      (raw.id as string | undefined) ??
      (raw.code as string | undefined) ??
      "—",
    name:
      (raw.indicator_name as string | undefined) ??
      (raw.name as string | undefined),
    score:
      (raw.aggregate_score as string | undefined) ??
      (raw.score as string | undefined),
    scoring_method: raw.scoring_method as string | undefined,
  }));
  const recommendations =
    (parsed?.recommendations as string[] | undefined) ?? [];

  // Agent-specific flagged items — what actual records the agent surfaced
  const flagged = extractFlagged(def.id, parsed);

  return (
    <div
      onClick={onSelect}
      className={`backdrop-blur-xl bg-white dark:bg-white/[0.05] border rounded-2xl shadow-sm dark:shadow-black/30 overflow-hidden animate-fade-up transition-[border-color,box-shadow] ${
        selected
          ? "border-indigo-400 dark:border-indigo-500/60 ring-1 ring-indigo-400/30 dark:ring-indigo-500/30"
          : "border-gray-200 dark:border-white/10"
      }`}
    >
      {/* Header strip */}
      <div className="relative">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${def.gradient}`} />
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-gray-200 dark:border-white/5">
          {/* Step number badge */}
          {typeof index === "number" && (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-mono text-[10px] font-bold text-gray-700 dark:text-gray-300 shrink-0">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <div
            className={`h-10 w-10 rounded-xl bg-gradient-to-br ${def.gradient} ${def.shadow} shadow-md flex items-center justify-center shrink-0`}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
                POA {def.poa}
              </span>
              {state.durationMs != null && (
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                  · {(state.durationMs / 1000).toFixed(1)}s
                </span>
              )}
              {state.status === "running" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-violet-600 dark:text-violet-300">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  scoring
                </span>
              )}
              {state.status === "queued" && (
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                  queued
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              {def.persona} — {def.step}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {def.role}
            </div>
          </div>
          {score && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Score
              </span>
              <ScoreBadge score={score} />
            </div>
          )}
          <Link
            href={def.href}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition shrink-0"
          >
            Open agent
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Body — input → output flow */}
      {!isReady ? (
        <div className="px-5 py-8 text-center">
          {state.status === "running" ? (
            <div className="inline-flex items-center gap-2 text-sm text-violet-600 dark:text-violet-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {def.persona} is scoring against the TADAT 2025 rubric…
            </div>
          ) : state.status === "error" ? (
            <div className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              {state.error ?? "agent failed"}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Queued — waiting for ingest…
            </p>
          )}
        </div>
      ) : (
        <div className="p-5 space-y-5">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] gap-4">
          {/* INPUT */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-md bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <Database className="h-3 w-3 text-indigo-600 dark:text-indigo-300" />
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400 truncate">
                  Input · pre-aggregated SQL
                </p>
              </div>
              {inputs != null && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRawInput((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition shrink-0"
                >
                  {showRawInput ? "Hide raw" : "View raw"}
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      showRawInput ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {inputTiles.map((t) => (
                <InputTile key={t.label} label={t.label} value={t.value} />
              ))}
            </div>
            {inputTiles.length === 0 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                No headline metrics in this agent&apos;s pre-aggregate.
              </p>
            )}

            {showRawInput && inputs != null && (
              <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Raw aggregate · what {def.persona} sees
                  </span>
                  <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500">
                    JSON
                  </span>
                </div>
                <pre className="max-h-72 overflow-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {JSON.stringify(inputs, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* FLOW ARROW — visible only on lg+ */}
          <div className="hidden lg:flex flex-col items-center justify-center gap-2 px-2">
            <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500 rotate-90 origin-center">
              TADAT 2025
            </div>
            <div className="relative h-32 w-px bg-gradient-to-b from-indigo-300 via-violet-300 to-purple-300 dark:from-indigo-500/60 dark:via-violet-500/60 dark:to-purple-500/60">
              <span className="absolute -bottom-1 -left-[3px] h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
            </div>
          </div>

          {/* OUTPUT */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-300" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                Output · generated by {def.persona}
              </p>
            </div>

            {outcome && (
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-gray-50 to-white dark:from-white/[0.03] dark:to-white/[0.01] p-3.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Business outcome
                </p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white leading-relaxed">
                  {outcome}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Full-width row — indicators, flagged records, recommendations */}
        {(rawIndicators.length > 0 ||
          (flagged && flagged.rows.length > 0) ||
          recommendations.length > 0) && (
          <div className="space-y-5 pt-2 border-t border-gray-200 dark:border-white/5">
            {rawIndicators.length > 0 && (
              <IndicatorTable
                indicators={rawIndicators}
                onPick={(d) => setOpenIndicator(d)}
              />
            )}

            {flagged && flagged.rows.length > 0 && (
              <FlaggedItems
                title={flagged.title}
                columns={flagged.columns}
                rows={flagged.rows}
              />
            )}

            {recommendations.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Recommendations
                </p>
                <ul className="space-y-1">
                  {recommendations.slice(0, 3).map((r, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[12.5px] text-gray-700 dark:text-gray-300 leading-relaxed"
                    >
                      <span className="text-indigo-500 dark:text-indigo-400 shrink-0">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* Modal — opens when an indicator row is clicked */}
      <IndicatorPanel
        open={openIndicator !== null}
        data={openIndicator}
        onClose={() => setOpenIndicator(null)}
      />
    </div>
  );
}

// ─── IndicatorTable ─ clickable table for indicators ────────────────────

function IndicatorTable({
  indicators,
  onPick,
}: {
  indicators: Array<Record<string, unknown>>;
  onPick: (data: IndicatorPanelData) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Indicators ({indicators.length}) · click any row
        </p>
        <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
          opens TADAT definition + evidence
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50/80 dark:bg-white/[0.03]">
            <tr>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Code
              </th>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Method
              </th>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Name
              </th>
              <th className="px-3 py-2 text-center font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Score
              </th>
              <th className="px-3 py-2 text-right font-mono uppercase tracking-wider text-[9.5px] text-gray-500 dark:text-gray-400">
                Evidence
              </th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((raw, i) => {
              const code =
                (raw.indicator_id as string) ??
                (raw.id as string) ??
                (raw.code as string) ??
                "—";
              const name =
                (raw.indicator_name as string) ??
                (raw.name as string) ??
                "";
              const score =
                (raw.aggregate_score as string) ??
                (raw.score as string) ??
                undefined;
              const method = raw.scoring_method as string | undefined;
              const finding = raw.finding as string | undefined;
              const detail = raw.detail as string | undefined;
              const evidence =
                ((raw.evidence as string[]) ??
                  []).concat(
                  // For v2 indicators, pull evidence from constituent dimensions.
                  ((raw.dimension_scores as Array<Record<string, unknown>>) ??
                    []
                  ).flatMap(
                    (d) => (d.evidence as string[]) ?? [],
                  ),
                );
              const ref = raw.tadat_reference as string | undefined;
              const dimensionScores =
                (raw.dimension_scores as Array<Record<string, unknown>>) ?? [];
              const data: IndicatorPanelData = {
                id: code,
                name,
                score,
                scoring_method: method,
                finding,
                detail,
                evidence,
                tadat_reference: ref,
                dimension_scores: dimensionScores.map((d) => ({
                  dim_id: (d.dim_id as string) ?? "—",
                  dim_name: d.dim_name as string | undefined,
                  score:
                    (d.score as string) ??
                    (d.aggregate_score as string) ??
                    undefined,
                  finding: d.finding as string | undefined,
                  detail: d.detail as string | undefined,
                  evidence: d.evidence as string[] | undefined,
                })),
              };
              return (
                <tr
                  key={`${code}-${i}`}
                  onClick={() => onPick(data)}
                  className="border-t border-gray-200 dark:border-white/5 cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-500/[0.06] transition focus:outline-none focus-visible:bg-indigo-50/60 dark:focus-visible:bg-indigo-500/10"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(data);
                    }
                  }}
                >
                  <td className="px-3 py-2.5 font-mono text-[11.5px] font-bold text-indigo-600 dark:text-indigo-300 whitespace-nowrap align-top">
                    {code}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap align-top">
                    {method && (
                      <span className="inline-flex items-center rounded-sm bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-gray-600 dark:text-gray-400">
                        {method}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-white leading-snug align-top">
                    <div className="line-clamp-2 max-w-[28ch] md:max-w-[40ch]">
                      {name || (
                        <span className="text-gray-400 dark:text-gray-500 italic">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap align-top">
                    {score ? (
                      <ScoreBadge score={score} />
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap align-top">
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-indigo-600 dark:text-indigo-300 group-hover:underline">
                      {evidence.length > 0 ? `${evidence.length} · view` : "view"}
                      <span aria-hidden>→</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── FlaggedItems ─ actual records each agent surfaced ──────────────────

function FlaggedItems({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">
        {title} ({rows.length})
      </p>
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-500/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10.5px]">
            <thead className="bg-emerald-100/30 dark:bg-emerald-500/[0.06]">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-2.5 py-1.5 text-left font-mono uppercase tracking-wider text-[9px] text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-t border-emerald-200/40 dark:border-emerald-500/10"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2.5 py-1.5 text-gray-800 dark:text-gray-200 font-mono tabular-nums whitespace-nowrap"
                    >
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Pull "what the agent actually flagged" from the parsed response.
 * Returns a column/row payload ready to render in <FlaggedItems>.
 * Different agents emit different worklists; this normalises across them.
 */
function extractFlagged(
  agentId: StageId,
  parsed: Record<string, unknown> | undefined,
): { title: string; columns: string[]; rows: Array<Array<string | number>> } | null {
  if (!parsed) return null;

  // Hamad — POA 2 — risk_register_top
  if (agentId === "risk") {
    const top =
      (parsed.risk_register_top as Array<Record<string, unknown>> | undefined) ??
      [];
    if (top.length === 0) return null;
    return {
      title: "Risks flagged",
      columns: ["Risk", "Segment", "Source", "AED at risk"],
      rows: top.slice(0, 6).map((r) => [
        (r.name as string) ?? "—",
        (r.segment as string) ?? "—",
        (r.source as string) ?? "data-derived",
        typeof r.estimated_aed_at_risk === "number"
          ? formatAedShort(r.estimated_aed_at_risk as number)
          : "—",
      ]),
    };
  }

  // Maya — POA 3 — make_it_easier_backlog
  if (agentId === "service") {
    const list =
      (parsed.make_it_easier_backlog as Array<Record<string, unknown>> | undefined) ??
      [];
    if (list.length === 0) return null;
    return {
      title: "Backlog flagged",
      columns: ["Action", "Priority", "Owner", "ETA"],
      rows: list.slice(0, 6).map((b) => [
        (b.action as string) ?? "—",
        (b.priority as string) ?? "—",
        (b.owner as string) ?? "—",
        (b.eta as string) ?? "—",
      ]),
    };
  }

  // Karim — POA 4 — non_filer_worklist.top_non_filers
  if (agentId === "filing") {
    const wl = parsed.non_filer_worklist as
      | { top_non_filers?: Array<Record<string, unknown>> }
      | undefined;
    const top = wl?.top_non_filers ?? [];
    if (top.length === 0) return null;
    return {
      title: "Non-filers flagged",
      columns: ["TRN", "Name", "Tax", "AED outstanding"],
      rows: top.slice(0, 6).map((d) => [
        maskTrn((d.trn as string) ?? "—"),
        truncate((d.name as string) ?? "—", 28),
        (d.tax_type as string) ?? "—",
        typeof d.aed_outstanding === "number"
          ? formatAedShort(d.aed_outstanding as number)
          : "—",
      ]),
    };
  }

  // Salma — POA 5 — high_risk_debtors
  if (agentId === "payments") {
    const list =
      (parsed.high_risk_debtors as Array<Record<string, unknown>> | undefined) ??
      [];
    if (list.length === 0) return null;
    return {
      title: "High-risk debtors flagged",
      columns: ["TRN", "Name", "Tax", "Age", "AED outstanding"],
      rows: list.slice(0, 6).map((d) => [
        maskTrn((d.trn as string) ?? "—"),
        truncate((d.legal_name_en as string) ?? "—", 26),
        (d.tax_type as string) ?? "—",
        (d.age_bucket as string) ?? "—",
        typeof d.outstanding_aed === "number"
          ? formatAedShort(d.outstanding_aed as number)
          : "—",
      ]),
    };
  }

  // Layla — POA 1 — derive flagged items from indicator evidence
  if (agentId === "registry") {
    const indicators =
      (parsed.indicators as Array<Record<string, unknown>> | undefined) ?? [];
    const items: Array<Array<string | number>> = [];
    for (const ind of indicators) {
      const evidence = (ind.evidence as string[] | undefined) ?? [];
      const id = (ind.id as string) ?? (ind.indicator_id as string) ?? "—";
      for (const e of evidence.slice(0, 2)) {
        items.push([id, e]);
        if (items.length >= 6) break;
      }
      if (items.length >= 6) break;
    }
    if (items.length === 0) return null;
    return {
      title: "Registry issues flagged",
      columns: ["Indicator", "Evidence"],
      rows: items,
    };
  }

  return null;
}

function formatAedShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toLocaleString()}`;
}

function maskTrn(trn: string): string {
  if (trn.length <= 6) return trn;
  return `…${trn.slice(-6)}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function FlowConnector({
  active,
  fromPersona,
  toPersona,
  caption,
}: {
  active: boolean;
  fromPersona?: string;
  toPersona?: string;
  caption?: string;
}) {
  const showHandoffText = Boolean(active && caption);
  return (
    <div
      className="flex items-stretch gap-3 py-1"
      role="presentation"
    >
      {/* Left rail — small vertical line + dot, anchored to the AgentDataFlow column edge */}
      <div className="flex flex-col items-center w-8 shrink-0" aria-hidden>
        <div
          className={`flex-1 w-px transition-colors duration-300 ${
            active
              ? "bg-gradient-to-b from-violet-400 to-indigo-400 dark:from-violet-500 dark:to-indigo-500"
              : "bg-gray-200 dark:bg-white/10"
          }`}
        />
        <div
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            active
              ? "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]"
              : "bg-gray-300 dark:bg-white/15"
          }`}
        />
        <div
          className={`flex-1 w-px transition-colors duration-300 ${
            active
              ? "bg-gradient-to-b from-indigo-400 to-violet-400 dark:from-indigo-500 dark:to-violet-500"
              : "bg-gray-200 dark:bg-white/10"
          }`}
        />
      </div>

      {/* Handoff caption */}
      <div className="flex-1 min-w-0 py-2">
        {showHandoffText ? (
          <div className="inline-flex items-start gap-2 rounded-lg border border-violet-200 dark:border-violet-500/25 bg-violet-50/60 dark:bg-violet-500/[0.07] px-3 py-1.5 max-w-prose">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300 shrink-0 mt-[2px]">
              {fromPersona} → {toPersona}
            </div>
            <p className="text-[11.5px] text-gray-700 dark:text-gray-300 leading-snug">
              {caption}
            </p>
          </div>
        ) : (
          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {fromPersona && toPersona
              ? `${fromPersona} → ${toPersona}`
              : "handoff"}
          </div>
        )}
      </div>
    </div>
  );
}

function InputTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2">
      <div className="text-[9px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 leading-tight">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-gray-900 dark:text-white leading-tight">
        {value}
      </div>
    </div>
  );
}

/**
 * Extract up to N "headline" tiles from a pre-aggregate JSON payload.
 * Picks scalar fields (numbers, percentages, short strings) and humanises
 * the keys. Skips objects/arrays at the top level (they're shown elsewhere).
 */
function extractTiles(
  inputs: unknown,
  max: number,
): Array<{ label: string; value: string }> {
  if (!inputs || typeof inputs !== "object") return [];
  const out: Array<{ label: string; value: string }> = [];

  function walk(obj: Record<string, unknown>, prefix = "", depth = 0) {
    if (depth > 2 || out.length >= max) return;
    for (const [k, v] of Object.entries(obj)) {
      if (out.length >= max) break;
      if (k === "fiscal_year" || k === "period_start" || k === "period_end") continue;
      if (typeof v === "number") {
        out.push({ label: humanise(k, prefix), value: formatNum(k, v) });
      } else if (typeof v === "string" && v.length > 0 && v.length < 40) {
        out.push({ label: humanise(k, prefix), value: v });
      } else if (Array.isArray(v)) {
        out.push({
          label: humanise(k, prefix) + " (count)",
          value: v.length.toLocaleString(),
        });
      } else if (v && typeof v === "object" && depth < 2) {
        walk(v as Record<string, unknown>, prefix ? `${prefix}.${k}` : k, depth + 1);
      }
    }
  }

  walk(inputs as Record<string, unknown>);
  return out.slice(0, max);
}

function humanise(key: string, prefix?: string): string {
  const full = (prefix ? `${prefix}.${key}` : key)
    .replace(/_/g, " ")
    .replace(/\./g, " · ")
    .replace(/\bpct\b/gi, "%")
    .replace(/\baed\b/gi, "AED");
  return full.charAt(0).toUpperCase() + full.slice(1);
}

function formatNum(key: string, n: number): string {
  const k = key.toLowerCase();
  if (k.includes("aed") && Math.abs(n) >= 1_000) {
    if (Math.abs(n) >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
    return `AED ${(n / 1_000).toFixed(0)}K`;
  }
  if (k.includes("pct") || k.includes("percent") || k.includes("rate")) {
    if (n <= 1) return `${(n * 100).toFixed(1)}%`;
    return `${n.toFixed(1)}%`;
  }
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return n.toLocaleString();
  if (Math.floor(n) === n) return n.toLocaleString();
  return n.toFixed(2);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
