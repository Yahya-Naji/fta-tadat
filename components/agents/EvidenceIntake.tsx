"use client";

/**
 * EvidenceIntake — the TADAT "request → upload" surface.
 *
 * This is Layla acting like a real assessor: instead of scoring a pre-cleaned
 * database, she asks the FTA the Field-Guide questions for each dimension and
 * requests the specific evidence the guide lists. The reviewer answers inline
 * and attaches documents. The collected answers + attachments become the
 * `EvidenceBundle` that the scoring step (Step 3) will process against Table 6.
 *
 * Reads the playbook from lib/tadat/evidence-requests.ts (sourced from
 * indicators.ts). Pure intake — no scoring happens here yet.
 */
import * as React from "react";
import {
  Paperclip,
  Check,
  ChevronDown,
  MessageSquareText,
  FileText,
  Inbox,
  Mail,
  Wand2,
} from "lucide-react";
import { POA1_SAMPLE } from "@/lib/tadat/poa1-sample";

import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PERSONAS, type AgentId } from "@/lib/personas";
import {
  buildEvidenceRequests,
  countRequests,
  type EvidenceRequestGroup,
} from "@/lib/tadat/evidence-requests";

// ─── Bundle shape (consumed by Step 3 scoring) ────────────────────────────
export interface EvidenceAnswer {
  question: string;
  answer: string;
}
export interface EvidenceItem {
  item: string;
  status: "provided" | "requested";
  file_name?: string;
  file_size?: number;
  note?: string;
}
export interface EvidenceGroupBundle {
  group_id: string;
  group_label: string;
  scope: EvidenceRequestGroup["scope"];
  indicator_code?: string;
  tadat_reference?: string;
  answers: EvidenceAnswer[];
  evidence: EvidenceItem[];
}
export interface EvidenceBundle {
  poa: number;
  groups: EvidenceGroupBundle[];
  totals: { questions_answered: number; questions: number; evidence_provided: number; evidence: number };
}

interface EvidenceIntakeProps {
  agentId: AgentId;
  poa: number;
  onBundleChange?: (bundle: EvidenceBundle) => void;
}

// answers keyed `${group_id}::q${i}` ; evidence keyed `${group_id}::e${i}`
type AnswerMap = Record<string, string>;
type EvidenceMap = Record<string, { file_name?: string; file_size?: number; note?: string }>;

export function EvidenceIntake({ agentId, poa, onBundleChange }: EvidenceIntakeProps) {
  const persona = PERSONAS[agentId];
  const groups = React.useMemo(() => buildEvidenceRequests(poa), [poa]);
  const totals = React.useMemo(() => countRequests(groups), [groups]);

  // Pre-filled email request to the business unit (the "collect by email"
  // channel from the brief). Opens the reviewer's mail client with the full
  // POA question + evidence list. Real send/intake is the next increment.
  const mailtoHref = React.useMemo(() => {
    const subject = `TADAT POA ${poa} — Evidence request (${persona.poaName})`;
    const lines: string[] = [
      "Dear Business Unit,",
      "",
      `As part of the TADAT POA ${poa} self-assessment (${persona.poaName}), please answer the following questions and attach the listed evidence:`,
      "",
    ];
    for (const g of groups) {
      lines.push(`== ${g.group_label} ==`);
      if (g.questions.length) {
        lines.push("Questions:");
        g.questions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
      }
      if (g.evidence_checklist.length) {
        lines.push("Evidence to attach:");
        g.evidence_checklist.forEach((e) => lines.push(`  - ${e}`));
      }
      lines.push("");
    }
    lines.push(`Kind regards,`, `${persona.name} · ${persona.role}`);
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }, [groups, poa, persona]);

  // Demo helper — fill the checklist from the bundled sample answers.
  const sampleAvailable = groups.some((g) => POA1_SAMPLE[g.group_id]);
  function applySample() {
    const nextA: AnswerMap = {};
    const nextE: EvidenceMap = {};
    for (const g of groups) {
      const s = POA1_SAMPLE[g.group_id];
      if (!s) continue;
      g.questions.forEach((_, i) => {
        if (s.answers[i]) nextA[`${g.group_id}::q${i}`] = s.answers[i];
      });
      g.evidence_checklist.forEach((_, i) => {
        const ev = s.evidence[i];
        if (ev && (ev.file_name || ev.note)) {
          nextE[`${g.group_id}::e${i}`] = {
            file_name: ev.file_name,
            note: ev.note,
          };
        }
      });
    }
    setAnswers(nextA);
    setEvidence(nextE);
    setOpen(Object.fromEntries(groups.map((g) => [g.group_id, true])));
  }

  // Per-item email request — asks the business unit for ONE specific document.
  function buildItemMailto(item: string, groupLabel: string): string {
    const subject = `TADAT POA ${poa} — Evidence request: ${item}`;
    const body = [
      "Dear Business Unit,",
      "",
      `For the TADAT POA ${poa} assessment (${persona.poaName}), please provide the following evidence under ${groupLabel}:`,
      "",
      `  • ${item}`,
      "",
      "Please reply with the document attached.",
      "",
      "Kind regards,",
      `${persona.name} · ${persona.role}`,
    ].join("\n");
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const [evidence, setEvidence] = React.useState<EvidenceMap>({});
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g, i) => [g.group_id, i <= 1])),
  );

  // Build + emit the bundle whenever intake state changes.
  React.useEffect(() => {
    if (!onBundleChange) return;
    let qa = 0;
    let ep = 0;
    const groupBundles: EvidenceGroupBundle[] = groups.map((g) => {
      const answersOut: EvidenceAnswer[] = g.questions.map((q, i) => {
        const a = (answers[`${g.group_id}::q${i}`] ?? "").trim();
        if (a) qa += 1;
        return { question: q, answer: a };
      });
      const evidenceOut: EvidenceItem[] = g.evidence_checklist.map((item, i) => {
        const rec = evidence[`${g.group_id}::e${i}`];
        const provided = !!(rec && (rec.file_name || (rec.note && rec.note.trim())));
        if (provided) ep += 1;
        return {
          item,
          status: provided ? "provided" : "requested",
          file_name: rec?.file_name,
          file_size: rec?.file_size,
          note: rec?.note?.trim() || undefined,
        };
      });
      return {
        group_id: g.group_id,
        group_label: g.group_label,
        scope: g.scope,
        indicator_code: g.indicator_code,
        tadat_reference: g.tadat_reference,
        answers: answersOut,
        evidence: evidenceOut,
      };
    });
    onBundleChange({
      poa,
      groups: groupBundles,
      totals: {
        questions_answered: qa,
        questions: totals.questions,
        evidence_provided: ep,
        evidence: totals.evidence,
      },
    });
  }, [answers, evidence, groups, totals, poa, onBundleChange]);

  // Live progress (for the header bar).
  const provided = React.useMemo(
    () =>
      groups.reduce(
        (acc, g) => {
          g.questions.forEach((_, i) => {
            if ((answers[`${g.group_id}::q${i}`] ?? "").trim()) acc.q += 1;
          });
          g.evidence_checklist.forEach((_, i) => {
            const r = evidence[`${g.group_id}::e${i}`];
            if (r && (r.file_name || (r.note && r.note.trim()))) acc.e += 1;
          });
          return acc;
        },
        { q: 0, e: 0 },
      ),
    [answers, evidence, groups],
  );

  const evidencePct =
    totals.evidence > 0 ? Math.round((provided.e / totals.evidence) * 100) : 0;

  return (
    <section className="glass-panel p-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <PersonaAvatar persona={persona} size={44} />
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400 mb-0.5">
              Evidence intake · POA {poa} · TADAT Phase 2
            </p>
            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              {persona.name} needs evidence to assess this area
            </h3>
            <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">
              Answer the Field-Guide questions and attach the requested documents.
              {persona.name} scores each dimension from what you provide — anything
              left empty is treated as <span className="font-semibold">insufficient evidence</span> (a D for that dimension).
            </p>
          </div>
        </div>

        {/* Actions + progress */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {sampleAvailable && (
              <button
                type="button"
                onClick={applySample}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
              >
                <Wand2 className="h-3.5 w-3.5" /> Load sample answers
              </button>
            )}
            <a
              href={mailtoHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
            >
              <Mail className="h-3.5 w-3.5" /> Request by email
            </a>
          </div>
          <div className="flex items-center gap-2">
            <ProgressChip
              icon={<MessageSquareText className="h-3 w-3" />}
              label="Questions"
              done={provided.q}
              total={totals.questions}
            />
            <ProgressChip
              icon={<Paperclip className="h-3 w-3" />}
              label="Evidence"
              done={provided.e}
              total={totals.evidence}
            />
          </div>
        </div>
      </div>

      {/* Evidence progress bar */}
      <div className="mt-4 h-1.5 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 transition-all"
          style={{ width: `${evidencePct}%` }}
        />
      </div>

      {/* Groups */}
      <div className="mt-4 space-y-2.5">
        {groups.map((g) => (
          <GroupCard
            key={g.group_id}
            group={g}
            open={open[g.group_id] ?? false}
            onToggle={() =>
              setOpen((s) => ({ ...s, [g.group_id]: !(s[g.group_id] ?? false) }))
            }
            answers={answers}
            evidence={evidence}
            setAnswer={(key, val) => setAnswers((s) => ({ ...s, [key]: val }))}
            setEvidenceFile={(key, file) =>
              setEvidence((s) => ({
                ...s,
                [key]: { ...s[key], file_name: file?.name, file_size: file?.size },
              }))
            }
            setEvidenceNote={(key, note) =>
              setEvidence((s) => ({ ...s, [key]: { ...s[key], note } }))
            }
            itemMailto={buildItemMailto}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────

function GroupCard({
  group,
  open,
  onToggle,
  answers,
  evidence,
  setAnswer,
  setEvidenceFile,
  setEvidenceNote,
  itemMailto,
}: {
  group: EvidenceRequestGroup;
  open: boolean;
  onToggle: () => void;
  answers: AnswerMap;
  evidence: EvidenceMap;
  setAnswer: (key: string, val: string) => void;
  setEvidenceFile: (key: string, file: File | null) => void;
  setEvidenceNote: (key: string, note: string) => void;
  itemMailto: (item: string, groupLabel: string) => string;
}) {
  const qDone = group.questions.filter(
    (_, i) => (answers[`${group.group_id}::q${i}`] ?? "").trim(),
  ).length;
  const eDone = group.evidence_checklist.filter((_, i) => {
    const r = evidence[`${group.group_id}::e${i}`];
    return r && (r.file_name || (r.note && r.note.trim()));
  }).length;
  const total = group.questions.length + group.evidence_checklist.length;
  const done = qDone + eDone;
  const complete = total > 0 && done === total;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition"
      >
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold shrink-0 ${
            complete
              ? "bg-emerald-500 text-white"
              : done > 0
                ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                : "bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400"
          }`}
        >
          {complete ? <Check className="h-3.5 w-3.5" /> : `${done}/${total}`}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
            {group.group_label}
          </p>
          {group.scope === "background" ? (
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400">
              Asked once, before scoring any dimension
            </p>
          ) : group.tadat_reference ? (
            <p className="text-[10.5px] font-mono text-gray-400 dark:text-gray-500 truncate">
              {group.tadat_reference}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100 dark:border-white/5">
          {/* Questions */}
          {group.questions.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 pt-3">
                <MessageSquareText className="h-3 w-3" /> Questions
              </p>
              {group.questions.map((q, i) => {
                const key = `${group.group_id}::q${i}`;
                const val = answers[key] ?? "";
                return (
                  <div key={key}>
                    <label className="block text-[12.5px] text-gray-700 dark:text-gray-300 leading-snug mb-1.5">
                      <span className="text-indigo-500 dark:text-indigo-400 font-mono mr-1">
                        {i + 1}.
                      </span>
                      {q}
                    </label>
                    <textarea
                      value={val}
                      onChange={(e) => setAnswer(key, e.target.value)}
                      rows={2}
                      placeholder="FTA response…"
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2 text-[12.5px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Evidence checklist */}
          {group.evidence_checklist.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                <Paperclip className="h-3 w-3" /> Requested evidence
              </p>
              {group.evidence_checklist.map((item, i) => {
                const key = `${group.group_id}::e${i}`;
                const rec = evidence[key];
                const provided = !!(rec && (rec.file_name || (rec.note && rec.note.trim())));
                return (
                  <EvidenceRow
                    key={key}
                    item={item}
                    provided={provided}
                    fileName={rec?.file_name}
                    note={rec?.note ?? ""}
                    onFile={(f) => setEvidenceFile(key, f)}
                    onNote={(n) => setEvidenceNote(key, n)}
                    requestHref={itemMailto(item, group.group_label)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Evidence row ─ attach a file or write a note ──────────────────────────

function EvidenceRow({
  item,
  provided,
  fileName,
  note,
  onFile,
  onNote,
  requestHref,
}: {
  item: string;
  provided: boolean;
  fileName?: string;
  note: string;
  onFile: (f: File | null) => void;
  onNote: (n: string) => void;
  requestHref: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [showNote, setShowNote] = React.useState(false);

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        provided
          ? "border-emerald-300/50 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/[0.04]"
          : "border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full shrink-0 ${
            provided
              ? "bg-emerald-500 text-white"
              : "bg-gray-200 text-gray-400 dark:bg-white/10 dark:text-gray-500"
          }`}
        >
          {provided ? <Check className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-gray-800 dark:text-gray-200 leading-snug">
            {item}
          </p>
          {fileName && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
              <Paperclip className="h-3 w-3" /> {fileName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <Paperclip className="h-3 w-3" />
            {fileName ? "Replace" : "Attach"}
          </button>
          <button
            onClick={() => setShowNote((s) => !s)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              showNote || (note && note.trim())
                ? "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
          >
            <MessageSquareText className="h-3 w-3" />
            Note
          </button>
          <a
            href={requestHref}
            title="Request this evidence by email"
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
          >
            <Mail className="h-3 w-3" />
            Email
          </a>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {(showNote || (note && note.trim())) && (
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={2}
          placeholder="Describe the evidence, link a system, or note why it's unavailable…"
          className="mt-2 w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2 text-[12px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y"
        />
      )}
    </div>
  );
}

// ─── Progress chip ──────────────────────────────────────────────────────────

function ProgressChip({
  icon,
  label,
  done,
  total,
}: {
  icon: React.ReactNode;
  label: string;
  done: number;
  total: number;
}) {
  const full = total > 0 && done === total;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono ${
        full
          ? "border-emerald-300/50 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300"
      }`}
    >
      {full ? <Check className="h-3 w-3" /> : icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="tabular-nums font-bold">
        {done}/{total}
      </span>
    </span>
  );
}

/** Tiny empty-state used by callers when a POA has no playbook yet. */
export function EvidenceIntakeEmpty({ persona }: { persona: string }) {
  return (
    <section className="glass-panel p-5 flex items-center gap-3 text-[12.5px] text-gray-500 dark:text-gray-400">
      <Inbox className="h-4 w-4 shrink-0" />
      {persona}&apos;s evidence playbook isn&apos;t authored yet — coming as we roll
      this flow out POA by POA.
    </section>
  );
}
