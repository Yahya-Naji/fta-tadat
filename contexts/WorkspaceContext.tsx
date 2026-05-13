"use client";

/**
 * WorkspaceContext — single source of truth for the multi-user workflow:
 *
 *   • currentUser — which persona is signed in (Layla/Hamad/Maya/Karim/Salma)
 *   • agents     — per-agent run state (idle | running | ready | handed_off | error)
 *   • notifications — handoff + system events, newest first
 *
 * Actions:
 *   • setCurrentUser(id)        — switch active persona
 *   • runMyAgent()              — POST /api/agents/{currentUser}/run + store output
 *   • handoffToDownstream()     — flip state to "handed_off" + fire notification
 *   • markNotificationRead(id)
 *   • markAllRead()
 *   • resetWorkspace()
 *
 * State is mirrored to localStorage so a reload doesn't lose work in
 * progress. Schema is versioned at WORKSPACE_STORAGE_KEY.
 */
import * as React from "react";

import { PERSONAS, type AgentId } from "@/lib/personas";
import {
  WORKFLOW_ORDER,
  DEFAULT_AGENT_STATE,
  WORKSPACE_STORAGE_KEY,
  upstreamOf,
  downstreamOf,
  type WorkspaceState,
  type WorkspaceNotification,
  type AgentRunState,
} from "@/lib/workflow/types";

// ─── Default state ────────────────────────────────────────────────────────

function emptyAgents(): Record<AgentId, AgentRunState> {
  return Object.fromEntries(
    WORKFLOW_ORDER.map((id) => [id, { ...DEFAULT_AGENT_STATE }]),
  ) as Record<AgentId, AgentRunState>;
}

function defaultState(): WorkspaceState {
  return {
    currentUser: "registry", // Start as Layla — the first user in the lifecycle
    agents: emptyAgents(),
    notifications: [],
  };
}

/**
 * Persona-tailored welcome message. Pushed once per persona on first
 * switch so the bell reads sensibly for whoever you're viewing.
 */
function introFor(id: AgentId): { title: string; body: string } {
  const p = PERSONAS[id];
  const i = WORKFLOW_ORDER.indexOf(id);
  const ordinal = ["1st", "2nd", "3rd", "4th", "5th"][i] ?? `${i + 1}th`;
  const up = upstreamOf(id);
  const down = downstreamOf(id);
  const upName = up ? PERSONAS[up].name : null;
  const downName = down ? PERSONAS[down].name : null;
  const role = upName && downName
    ? `Take ${upName}'s output, run your agent, then hand off to ${downName}.`
    : upName
      ? `Take ${upName}'s output, run your agent — the lifecycle ends with you.`
      : downName
        ? `You're first — run your agent, then hand off to ${downName}.`
        : `You're the only user in this workflow.`;
  return {
    title: `Welcome to your desk, ${p.name}`,
    body: `You're the ${ordinal} step of the lifecycle — ${p.poaName}. ${role}`,
  };
}

/**
 * Push a one-time "welcome to your desk, {persona}" intro if the persona
 * doesn't already have one. Safe to call repeatedly — idempotent.
 */
function ensureIntroFor(s: WorkspaceState, id: AgentId): WorkspaceState {
  const alreadyHasIntro = s.notifications.some(
    (n) => n.kind === "system" && n.from_agent === "system" && n.to_agent === id,
  );
  if (alreadyHasIntro) return s;
  const intro = introFor(id);
  const introNotif: WorkspaceNotification = {
    id: cryptoRandom(),
    ts: Date.now(),
    kind: "system",
    from_agent: "system",
    to_agent: id,
    title: intro.title,
    body: intro.body,
    read: false,
  };
  return {
    ...s,
    notifications: [introNotif, ...s.notifications].slice(0, 50),
  };
}

// ─── Context shape ────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  state: WorkspaceState;
  setCurrentUser: (id: AgentId) => void;
  runMyAgent: () => Promise<void>;
  handoffToDownstream: () => void;
  /** Hand off FROM a specific agent — used by department pages where the
   *  agent on display isn't necessarily the currentUser. Optionally seeds
   *  the agent's run state if the caller has fresh data from a local run. */
  handoffFromAgent: (
    fromId: AgentId,
    snapshot?: { score?: string; outcome?: string },
  ) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  resetWorkspace: () => void;
  /** Convenience: how many notifications target the current user and are unread. */
  unreadForMe: number;
  isHydrated: boolean;
}

const WorkspaceCtx = React.createContext<WorkspaceContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WorkspaceState>(defaultState);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Hydrate from localStorage on mount (avoids SSR hydration mismatch by
  // only swapping in after first paint).
  React.useEffect(() => {
    let next: WorkspaceState | null = null;
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkspaceState;
        if (parsed.currentUser && parsed.agents && parsed.notifications) {
          next = parsed;
        }
      }
    } catch {
      /* ignore */
    }
    const baseState = next ?? defaultState();
    // Migration: drop any old generic "Welcome to your desk" notification
    // that was addressed to "all" — it referenced a hardcoded persona name
    // and is now superseded by per-persona intros.
    const cleaned: WorkspaceState = {
      ...baseState,
      notifications: baseState.notifications.filter(
        (n) =>
          !(
            n.kind === "system" &&
            n.from_agent === "system" &&
            n.to_agent === "all" &&
            n.title === "Welcome to your desk"
          ),
      ),
    };
    setState(ensureIntroFor(cleaned, cleaned.currentUser));
    setIsHydrated(true);
  }, []);

  // Persist whenever state changes (skip until hydrated to avoid stomping).
  React.useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state, isHydrated]);

  const setCurrentUser = React.useCallback((id: AgentId) => {
    setState((s) => ensureIntroFor({ ...s, currentUser: id }, id));
  }, []);

  const pushNotification = React.useCallback(
    (n: Omit<WorkspaceNotification, "id" | "ts" | "read">) => {
      setState((s) => ({
        ...s,
        notifications: [
          {
            ...n,
            id: cryptoRandom(),
            ts: Date.now(),
            read: false,
          },
          ...s.notifications,
        ].slice(0, 50), // cap
      }));
    },
    [],
  );

  const runMyAgent = React.useCallback(async () => {
    const id = state.currentUser;
    setState((s) => ({
      ...s,
      agents: {
        ...s.agents,
        [id]: { ...s.agents[id], status: "running" },
      },
    }));
    const t0 = Date.now();
    try {
      const r = await fetch(`/api/agents/${id}/run`, { method: "POST" });
      const j = (await r.json()) as {
        success: boolean;
        parsed?: Record<string, unknown>;
        inputs?: unknown;
        duration_ms?: number;
        error?: string;
      };
      if (!j.success || !j.parsed) {
        setState((s) => ({
          ...s,
          agents: {
            ...s.agents,
            [id]: {
              ...s.agents[id],
              status: "error",
              error: j.error ?? "agent failed",
            },
          },
        }));
        return;
      }
      const score =
        (j.parsed.poa_aggregate_score as string | undefined) ??
        (j.parsed.aggregate_score as string | undefined);
      const outcome =
        (j.parsed.business_outcome as string | undefined) ??
        (j.parsed.recommendations as string[] | undefined)?.[0];
      const now = Date.now();
      setState((s) => ({
        ...s,
        agents: {
          ...s.agents,
          [id]: {
            status: "ready",
            score,
            outcome,
            parsed: j.parsed,
            inputs: j.inputs,
            duration_ms: j.duration_ms ?? now - t0,
            finished_at: now,
          },
        },
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        agents: {
          ...s.agents,
          [id]: {
            ...s.agents[id],
            status: "error",
            error: (e as Error).message,
          },
        },
      }));
    }
  }, [state.currentUser]);

  const handoffToDownstream = React.useCallback(() => {
    const from = state.currentUser;
    const to = downstreamOf(from);
    if (!to) return; // last agent — nothing to hand off

    const me = state.agents[from];
    const fromPersona = PERSONAS[from];
    const toPersona = PERSONAS[to];

    setState((s) => ({
      ...s,
      agents: {
        ...s.agents,
        [from]: {
          ...s.agents[from],
          status: "handed_off",
          handed_off_at: Date.now(),
        },
      },
    }));

    pushNotification({
      kind: "handoff",
      from_agent: from,
      to_agent: to,
      title: `${fromPersona.name} → ${toPersona.name}: it's on your desk`,
      body: `${fromPersona.name} finished ${fromPersona.poaName.toLowerCase()} (POA ${fromPersona.poa}). Verdict: ${me.score ?? "—"}. ${me.outcome ?? ""}`.trim(),
    });
  }, [state.currentUser, state.agents, pushNotification]);

  const handoffFromAgent = React.useCallback(
    (fromId: AgentId, snapshot?: { score?: string; outcome?: string }) => {
      const to = downstreamOf(fromId);
      if (!to) return;
      const fromPersona = PERSONAS[fromId];
      const toPersona = PERSONAS[to];
      setState((s) => {
        const prev = s.agents[fromId];
        return {
          ...s,
          agents: {
            ...s.agents,
            [fromId]: {
              ...prev,
              status: "handed_off",
              handed_off_at: Date.now(),
              score: snapshot?.score ?? prev.score,
              outcome: snapshot?.outcome ?? prev.outcome,
            },
          },
        };
      });
      const score = snapshot?.score ?? state.agents[fromId]?.score ?? "—";
      const outcome = snapshot?.outcome ?? state.agents[fromId]?.outcome ?? "";
      pushNotification({
        kind: "handoff",
        from_agent: fromId,
        to_agent: to,
        title: `${fromPersona.name} → ${toPersona.name}: it's on your desk`,
        body: `${fromPersona.name} finished ${fromPersona.poaName.toLowerCase()} (POA ${fromPersona.poa}). Verdict: ${score}. ${outcome}`.trim(),
      });
    },
    [state.agents, pushNotification],
  );

  const markNotificationRead = React.useCallback((id: string) => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  }, []);

  const markAllRead = React.useCallback(() => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.to_agent === "all" || n.to_agent === s.currentUser
          ? { ...n, read: true }
          : n,
      ),
    }));
  }, []);

  const resetWorkspace = React.useCallback(() => {
    setState(defaultState());
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const unreadForMe = React.useMemo(
    () =>
      state.notifications.filter(
        (n) =>
          !n.read &&
          (n.to_agent === state.currentUser || n.to_agent === "all"),
      ).length,
    [state.notifications, state.currentUser],
  );

  const value: WorkspaceContextValue = {
    state,
    setCurrentUser,
    runMyAgent,
    handoffToDownstream,
    handoffFromAgent,
    markNotificationRead,
    markAllRead,
    resetWorkspace,
    unreadForMe,
    isHydrated,
  };

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const v = React.useContext(WorkspaceCtx);
  if (!v) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return v;
}

// ─── tiny ID helper (deterministic-ish, no extra deps) ───────────────────

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
