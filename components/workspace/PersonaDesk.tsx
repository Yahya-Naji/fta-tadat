"use client";

/**
 * PersonaDesk — renders the active user's workspace.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Welcome header — persona avatar, name, POA, role            │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ INBOX — what upstream agent handed over (if any)            │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ MY WORK — Run my agent · status · score · outcome           │
 *   │   Once ready: [Send to downstream] button                   │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ FLAGGED OUTPUT — actual records this user has surfaced       │
 *   └─────────────────────────────────────────────────────────────┘
 */
import * as React from "react";
import Link from "next/link";
import {
  Inbox,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Building2,
} from "lucide-react";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { PERSONAS, type AgentId } from "@/lib/personas";
import { upstreamOf, downstreamOf } from "@/lib/workflow/types";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { ScoreBadge } from "@/components/ScoreBadge";

export function PersonaDesk() {
  const { state, handoffToDownstream, isHydrated } = useWorkspace();
  const meId = state.currentUser;
  const me = PERSONAS[meId];
  const myRun = state.agents[meId];

  const upId = upstreamOf(meId);
  const upPersona = upId ? PERSONAS[upId] : null;
  const upRun = upId ? state.agents[upId] : null;

  const downId = downstreamOf(meId);
  const downPersona = downId ? PERSONAS[downId] : null;

  if (!isHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
          Loading desk…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Welcome header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-7 md:p-8 shadow-2xl shadow-indigo-500/20 animate-fade-up">
        <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start gap-5 justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <PersonaAvatar persona={me} size={64} />
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/65 mb-1">
                Signed in · POA {me.poa}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                Welcome, {me.name}
              </h1>
              <p className="mt-1 text-sm text-white/80">{me.role}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/65 mb-1">
              Your POA
            </p>
            <p className="text-[12px] text-white/85 max-w-[260px]">
              {me.poaName}
            </p>
          </div>
        </div>
        <p className="relative mt-5 text-[13.5px] text-white/85 leading-relaxed max-w-3xl">
          {me.bio}
        </p>

        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/agents/${meId}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-indigo-700 hover:opacity-90 transition shadow-md shadow-black/20"
          >
            <Building2 className="h-4 w-4" />
            Open {me.name}&apos;s department
            <span aria-hidden>→</span>
          </Link>
          <span className="text-[11px] text-white/65">
            charts, chat with {me.name}, and the full TADAT assessment
          </span>
        </div>
      </div>

      {/* INBOX — what upstream handed off (read-only) */}
      <Section
        eyebrow="Inbox · from upstream"
        title={
          upPersona
            ? `From ${upPersona.name} — ${upPersona.poaName}`
            : "You are first in the lifecycle"
        }
        icon={Inbox}
      >
        {!upPersona ? (
          <div className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
            You don&apos;t have an upstream colleague — your registry audit is
            the foundation every downstream agent builds on. Open your{" "}
            <strong>department</strong> to run the agent; come back here to
            hand off to <strong>{downPersona?.name ?? "the next user"}</strong>.
          </div>
        ) : (
          <InboxFromUpstream upId={upId!} upPersona={upPersona} upRun={upRun!} />
        )}
      </Section>

      {/* HANDOFF — outbound only. Run happens in the department. */}
      <Section
        eyebrow="Outbox · hand off"
        title={
          downPersona
            ? `Pass to ${downPersona.name} — ${downPersona.poaName}`
            : "You are last in the lifecycle"
        }
        icon={Sparkles}
      >
        <HandoffPanel
          meId={meId}
          myRun={myRun}
          downPersona={downPersona}
          onHandoff={handoffToDownstream}
        />
      </Section>

      {/* Quick footer link to the full agent detail */}
      <div className="text-center pt-2">
        <Link
          href={`/agents/${meId}`}
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition"
        >
          Open {me.name}&apos;s full TADAT assessment
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/30">
          <Icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
            {eyebrow}
          </p>
          <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white leading-tight">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function InboxFromUpstream({
  upPersona,
  upRun,
}: {
  upId: AgentId;
  upPersona: (typeof PERSONAS)[AgentId];
  upRun: import("@/lib/workflow/types").AgentRunState;
}) {
  if (upRun.status === "idle") {
    return (
      <div className="rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 leading-relaxed">
        <strong>{upPersona.name}</strong> hasn&apos;t started yet. Switch to{" "}
        <strong>{upPersona.name}&apos;s</strong> desk and run their agent first
        — your work depends on what {upPersona.name} produces.
      </div>
    );
  }
  if (upRun.status === "running") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-4 py-2.5 text-[13px] text-violet-700 dark:text-violet-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        {upPersona.name} is still scoring…
      </div>
    );
  }
  if (upRun.status === "error") {
    return (
      <div className="rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-300">
        {upPersona.name}&apos;s agent failed — {upRun.error ?? "unknown error"}.
        Switch to their desk to retry.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-500/[0.05] p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <PersonaAvatar persona={upPersona} size={28} />
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              {upPersona.name}&apos;s verdict — POA {upPersona.poa}
            </div>
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
              {upRun.status === "handed_off" ? "Handed off" : "Awaiting handoff"}
              {upRun.duration_ms != null &&
                ` · scored in ${(upRun.duration_ms / 1000).toFixed(1)}s`}
            </div>
          </div>
        </div>
        {upRun.score && <ScoreBadge score={upRun.score} />}
      </div>
      {upRun.outcome && (
        <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed">
          {upRun.outcome}
        </p>
      )}
      {upRun.status === "ready" && (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          Note: {upPersona.name} hasn&apos;t formally handed this to you yet.
          Their desk has a&nbsp;<em>Send to next</em>&nbsp;button.
        </p>
      )}
    </div>
  );
}

function HandoffPanel({
  meId,
  myRun,
  downPersona,
  onHandoff,
}: {
  meId: AgentId;
  myRun: import("@/lib/workflow/types").AgentRunState;
  downPersona: (typeof PERSONAS)[AgentId] | null;
  onHandoff: () => void;
}) {
  const me = PERSONAS[meId];

  // Case 1 — agent hasn't been run yet. Direct them to the department.
  if (myRun.status === "idle" || myRun.status === "running") {
    return (
      <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] p-4 flex flex-wrap items-start gap-3 justify-between">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-snug">
              {myRun.status === "running"
                ? `${me.name} is scoring now — come back when the run finishes.`
                : `Run your agent first.`}
            </p>
            <p className="mt-1 text-[12px] text-gray-700 dark:text-gray-300 leading-snug">
              The handoff button unlocks once {me.name}&apos;s verdict is on
              record. The run happens in your department — that&apos;s where
              charts, evidence, and the chat live.
            </p>
          </div>
        </div>
        <Link
          href={`/agents/${meId}`}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2 text-[13px] font-bold text-white shadow-lg shadow-violet-500/25 hover:opacity-95 transition shrink-0"
        >
          Open my department
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // Case 2 — error.
  if (myRun.status === "error") {
    return (
      <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-[13px] text-red-700 dark:text-red-300 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1">
          <strong>Run failed:</strong> {myRun.error ?? "unknown error"}. Retry
          from <Link href={`/agents/${meId}`} className="underline">{me.name}&apos;s department</Link>.
        </div>
      </div>
    );
  }

  // Case 3 — ready or already handed off.
  const handedOff = myRun.status === "handed_off";
  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50 to-violet-50/60 dark:from-indigo-500/[0.06] dark:to-violet-500/[0.04] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              Your verdict — ready to pass on
            </p>
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400">
              {myRun.duration_ms != null && `scored in ${(myRun.duration_ms / 1000).toFixed(1)}s`}
              {myRun.finished_at && " · " + new Date(myRun.finished_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <ScoreBadge score={myRun.score} />
      </div>
      {myRun.outcome && (
        <p className="text-[13.5px] text-gray-900 dark:text-white font-medium leading-relaxed mb-4">
          {myRun.outcome}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {downPersona ? (
          handedOff ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Handed off to {downPersona.name}
            </span>
          ) : (
            <button
              type="button"
              onClick={onHandoff}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-2 text-[13px] font-bold text-white shadow-lg shadow-violet-500/25 hover:opacity-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Send to {downPersona.name}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Lifecycle complete — {me.name} is the last user
          </span>
        )}
        <Link
          href={`/agents/${meId}`}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition"
        >
          <ExternalLink className="h-3 w-3" />
          Open department
        </Link>
      </div>
    </div>
  );
}

