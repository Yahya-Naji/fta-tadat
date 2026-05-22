"use client";

/**
 * DepartmentChat — chat panel for a single agent's department page.
 *
 * Streams replies from /api/agents/[id]/chat via SSE. Each user message
 * is sent with the agent's latest parsed JSON + pre-aggregate inputs so
 * the model can answer questions scoped to what the agent actually saw.
 *
 * History is per-agent, persisted to localStorage so a reload doesn't
 * wipe the conversation. Auto-scrolls on new tokens.
 */
import * as React from "react";
import { Send, Loader2, Sparkles, Trash2, AlertCircle } from "lucide-react";

import { PERSONAS, type AgentId } from "@/lib/personas";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
  streaming?: boolean;
  error?: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface DepartmentChatProps {
  agentId: AgentId;
  parsed: Record<string, unknown> | null;
  inputs: unknown;
  className?: string;
  /** When true, the chat runs as an evidence INTERVIEW: enabled before any
   *  scoring run, and Layla asks the playbook questions. */
  interviewMode?: boolean;
  /** Emits the running transcript so the parent can feed it into scoring. */
  onTranscriptChange?: (turns: ChatTurn[]) => void;
}

export function DepartmentChat({
  agentId,
  parsed,
  inputs,
  className,
  interviewMode = false,
  onTranscriptChange,
}: DepartmentChatProps) {
  const persona = PERSONAS[agentId];
  const storageKey = `qtax.chat.${agentId}.v1`;

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Hydrate per-agent history
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsedHist = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsedHist)) setMessages(parsedHist);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  // Persist
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages, hydrated, storageKey]);

  // Autoscroll on new content
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Emit transcript to the parent so the scoring run can read the interview.
  React.useEffect(() => {
    if (!onTranscriptChange) return;
    onTranscriptChange(
      messages
        .filter((m) => !m.error && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content })),
    );
  }, [messages, onTranscriptChange]);

  // Suggested first prompts when chat is empty
  const SUGGESTIONS = React.useMemo(() => {
    if (interviewMode) {
      return [
        `Start the POA ${persona.poa} interview`,
        `What evidence do you need from me?`,
        `Let's start with accuracy (P1-1-2)`,
        `I'll attach documents in the checklist instead`,
      ];
    }
    const code = `P${persona.poa}`;
    return [
      `Why did you score the overall POA the way you did?`,
      `Walk me through ${code} — which indicator weighs most?`,
      `Show me the three weakest dimensions in your work.`,
      `What would it take to lift your worst indicator one band?`,
    ];
  }, [persona.poa, interviewMode]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setDraft("");
    setSending(true);

    const userMsg: ChatMessage = {
      role: "user",
      content: text.trim(),
      ts: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      ts: Date.now(),
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const r = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages
              .filter((m) => !m.error)
              .map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text.trim() },
          ],
          parsed,
          inputs,
        }),
        signal: ctrl.signal,
      });
      if (!r.body) throw new Error("no body");

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          handleSse(block);
        }
      }
      // Final cleanup — clear streaming flag
      setMessages((prev) =>
        prev.map((m, i, arr) =>
          i === arr.length - 1 && m.role === "assistant"
            ? { ...m, streaming: false }
            : m,
        ),
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((m, i, arr) =>
            i === arr.length - 1
              ? { ...m, streaming: false, content: m.content || "(stopped)" }
              : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m, i, arr) =>
            i === arr.length - 1
              ? {
                  ...m,
                  streaming: false,
                  error: true,
                  content: `Error: ${(e as Error).message}`,
                }
              : m,
          ),
        );
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      inputRef.current?.focus();
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
    if (event === "token") {
      const v = payload.v as string | undefined;
      if (!v) return;
      setMessages((prev) =>
        prev.map((m, i, arr) =>
          i === arr.length - 1 && m.role === "assistant"
            ? { ...m, content: m.content + v }
            : m,
        ),
      );
    } else if (event === "fatal") {
      setMessages((prev) =>
        prev.map((m, i, arr) =>
          i === arr.length - 1
            ? {
                ...m,
                streaming: false,
                error: true,
                content: `Error: ${(payload.error as string) ?? "unknown"}`,
              }
            : m,
        ),
      );
    }
  }

  function clearHistory() {
    if (sending) return;
    if (!confirm(`Clear your chat history with ${persona.name}?`)) return;
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  const hasContext = parsed !== null;
  // Interview mode enables the chat before any scoring run.
  const chatEnabled = interviewMode || hasContext;

  return (
    <div
      className={`glass-panel flex flex-col h-[640px] max-h-[80vh] overflow-hidden ${
        className ?? ""
      }`}
    >
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200 dark:border-white/5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`h-9 w-9 rounded-xl bg-gradient-to-br ${persona.avatarGradient} flex items-center justify-center text-white font-bold text-sm shrink-0`}
          >
            {persona.initials}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
              Ask {persona.name}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              POA {persona.poa} · {persona.role}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10.5px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white shrink-0"
            disabled={sending}
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        )}
      </header>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        aria-live="polite"
      >
        {!hasContext && !interviewMode && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                  No assessment yet
                </p>
                <p className="text-[11.5px] text-amber-700 dark:text-amber-300/90 leading-snug mt-0.5">
                  {persona.name} can answer once you click <strong>Run</strong>{" "}
                  in the department banner above. The chat is scoped to{" "}
                  {persona.name}&apos;s latest assessment + pre-aggregate inputs.
                </p>
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && chatEnabled && (
          <div className="space-y-3">
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-gray-900 dark:text-white">
                    Hi — I&apos;m {persona.name}.
                  </p>
                  <p className="text-[11.5px] text-gray-700 dark:text-gray-300 leading-snug mt-0.5">
                    {interviewMode ? (
                      <>
                        I&apos;ll walk you through the POA {persona.poa} evidence
                        questions one at a time. Answer here (or use the checklist
                        above), then click{" "}
                        <strong>Process evidence &amp; score</strong> when we&apos;re
                        done. Anything left unanswered scores a D.
                      </>
                    ) : (
                      <>
                        Ask me anything about my POA {persona.poa} assessment —
                        why I gave a score, what evidence drove it, or what it
                        would take to move a band.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[9.5px] font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Try
              </p>
              <div className="grid gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="text-left rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2 text-[12px] text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/[0.06] transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} persona={persona} />
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="border-t border-gray-200 dark:border-white/5 px-3 py-2.5 shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            disabled={!chatEnabled || sending}
            rows={1}
            placeholder={
              chatEnabled
                ? interviewMode
                  ? `Answer ${persona.name}…`
                  : `Ask ${persona.name}…`
                : "Run the agent first to enable chat"
            }
            className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-[12.5px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 max-h-32"
          />
          {sending ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition shrink-0"
              aria-label="Stop streaming"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!chatEnabled || !draft.trim()}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 text-white shadow-md shadow-violet-500/25 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[9.5px] font-mono text-gray-400 dark:text-gray-500">
          {interviewMode
            ? `${persona.name} is collecting evidence for scoring.`
            : `${persona.name} sees her latest assessment + pre-aggregate inputs.`}{" "}
          Enter to send · Shift+Enter for newline.
        </p>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  persona,
}: {
  message: ChatMessage;
  persona: (typeof PERSONAS)[AgentId];
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 text-white px-3.5 py-2 text-[12.5px] leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div
        className={`h-6 w-6 rounded-md bg-gradient-to-br ${persona.avatarGradient} flex items-center justify-center text-white font-bold text-[10px] shrink-0 mt-0.5`}
      >
        {persona.initials}
      </div>
      <div
        className={`max-w-[88%] rounded-2xl rounded-tl-md px-3.5 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
          message.error
            ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30"
            : "bg-gray-100 dark:bg-white/[0.05] text-gray-900 dark:text-gray-100"
        }`}
      >
        {message.content}
        {message.streaming && (
          <span className="inline-block w-1.5 h-3.5 bg-indigo-500 align-[-2px] ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}
