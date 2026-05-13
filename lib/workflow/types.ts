/**
 * Workspace / multi-user workflow types.
 *
 * Each persona (Layla, Hamad, Maya, Karim, Salma) is both an agent AND a
 * user. Switching the active user changes the desk view; when an agent
 * finishes its run, a notification fires to the next user downstream so
 * they see "this is on your desk now".
 */
import type { AgentId } from "@/lib/personas";

export const WORKFLOW_ORDER: AgentId[] = [
  "registry", // Layla — POA 1
  "risk",     // Hamad — POA 2
  "service",  // Maya  — POA 3
  "filing",   // Karim — POA 4
  "payments", // Salma — POA 5
];

/** What comes before this agent in the lifecycle (null if first). */
export function upstreamOf(id: AgentId): AgentId | null {
  const i = WORKFLOW_ORDER.indexOf(id);
  return i > 0 ? WORKFLOW_ORDER[i - 1] : null;
}

/** What comes after this agent (null if last). */
export function downstreamOf(id: AgentId): AgentId | null {
  const i = WORKFLOW_ORDER.indexOf(id);
  return i >= 0 && i < WORKFLOW_ORDER.length - 1
    ? WORKFLOW_ORDER[i + 1]
    : null;
}

/** Per-agent runtime state — what they've produced. */
export interface AgentRunState {
  status: "idle" | "running" | "ready" | "handed_off" | "error";
  /** When the run completed. */
  finished_at?: number;
  /** When the user handed off to downstream. */
  handed_off_at?: number;
  /** Aggregate score (A/B/C/D, +/-). */
  score?: string;
  /** One-sentence business outcome. */
  outcome?: string;
  /** Run duration in ms. */
  duration_ms?: number;
  /** Raw parsed agent JSON — used to render flagged items. */
  parsed?: Record<string, unknown>;
  /** Pre-aggregated SQL inputs the LLM received. */
  inputs?: unknown;
  /** Error message if status is "error". */
  error?: string;
}

export type NotificationKind = "handoff" | "info" | "system";

export interface WorkspaceNotification {
  id: string;
  ts: number;
  kind: NotificationKind;
  /** Who triggered the notification (the agent who finished). */
  from_agent: AgentId | "system";
  /** Who the notification is for. */
  to_agent: AgentId | "all";
  /** Short headline displayed in the bell dropdown. */
  title: string;
  /** Longer body shown in the notification centre. */
  body: string;
  read: boolean;
}

export interface WorkspaceState {
  /** Persona currently signed in / viewed. */
  currentUser: AgentId;
  /** Per-agent run state. */
  agents: Record<AgentId, AgentRunState>;
  /** Notifications in reverse-chrono order (newest first). */
  notifications: WorkspaceNotification[];
}

export const DEFAULT_AGENT_STATE: AgentRunState = { status: "idle" };

/**
 * Schema-versioned localStorage key. Bump on breaking shape changes so
 * stale state doesn't crash hydration after a deploy.
 */
export const WORKSPACE_STORAGE_KEY = "qtax.workspace.v1";
