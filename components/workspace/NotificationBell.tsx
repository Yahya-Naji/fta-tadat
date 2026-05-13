"use client";

/**
 * NotificationBell — top-right bell icon with unread badge. Click to open
 * a panel listing recent handoff + system notifications. Items targeted
 * at the current user (or "all") show in normal styling; items addressed
 * to OTHER users are dimmed (you see them but they're not "for you").
 */
import * as React from "react";
import { Bell, Check, Sparkles } from "lucide-react";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { PERSONAS } from "@/lib/personas";

export function NotificationBell() {
  const { state, unreadForMe, markNotificationRead, markAllRead } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Each persona has their OWN inbox — only show notifications addressed
  // to the active user or to "all" (system-wide). Other users' handoffs
  // and intros never appear in your bell.
  const myNotifications = React.useMemo(
    () =>
      state.notifications.filter(
        (n) => n.to_agent === "all" || n.to_agent === state.currentUser,
      ),
    [state.notifications, state.currentUser],
  );

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`Notifications · ${unreadForMe} unread`}
      >
        <Bell className="h-4 w-4" />
        {unreadForMe > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-[9px] font-bold text-white shadow-sm shadow-violet-500/40">
            {unreadForMe > 9 ? "9+" : unreadForMe}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e2128] shadow-xl shadow-black/10 dark:shadow-black/40 z-50 animate-fade-in overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
                Notifications
              </p>
              <p className="text-[10.5px] text-gray-500 dark:text-gray-400">
                {unreadForMe} unread for you
              </p>
            </div>
            {myNotifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {myNotifications.length === 0 && (
              <li className="px-4 py-6 text-center text-[12px] text-gray-500 dark:text-gray-400">
                No notifications for {PERSONAS[state.currentUser].name} yet.
              </li>
            )}
            {myNotifications.map((n) => {
              const fromPersona =
                n.from_agent !== "system" ? PERSONAS[n.from_agent] : null;
              return (
                <li
                  key={n.id}
                  className={`px-3 py-2.5 transition ${
                    n.read
                      ? "bg-white dark:bg-transparent"
                      : "bg-indigo-50/40 dark:bg-indigo-500/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {fromPersona ? (
                      <div
                        className={`h-7 w-7 rounded-lg bg-gradient-to-br ${fromPersona.avatarGradient} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}
                      >
                        {fromPersona.initials}
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-[12px] font-bold text-gray-900 dark:text-white leading-tight">
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        )}
                      </div>
                      <p className="text-[11.5px] leading-snug text-gray-700 dark:text-gray-300">
                        {n.body}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                          {formatRelative(n.ts)}
                        </span>
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(n.id)}
                            className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const d = new Date(ts);
  return d.toLocaleDateString();
}
