"use client";

/**
 * /desk — the workspace page. Renders the current user's desk with:
 *   • Top bar with QTax wordmark + UserSwitcher + NotificationBell + ThemeToggle
 *   • PersonaDesk for whoever is currently signed in
 */
import Link from "next/link";
import { ChevronLeft, RefreshCw } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { QTaskWordmark } from "@/components/QTaskLogo";
import { UserSwitcher } from "@/components/workspace/UserSwitcher";
import { NotificationBell } from "@/components/workspace/NotificationBell";
import { PersonaDesk } from "@/components/workspace/PersonaDesk";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function DeskPage() {
  const { resetWorkspace } = useWorkspace();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#282C34]">
      <div className="page-accent-bar" />

      {/* Top bar */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur dark:border-white/5 dark:bg-[#1e2128]/80 sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white shrink-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <QTaskWordmark />
            <span className="hidden md:inline text-gray-300 dark:text-white/20">|</span>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
                Your inbox
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                · handoffs + notifications
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset the workspace? This clears every persona's run state and notifications.")) {
                  resetWorkspace();
                }
              }}
              className="hidden md:inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 transition"
              title="Reset all desks + notifications"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </button>
            <NotificationBell />
            <UserSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 md:px-6 py-8">
        <PersonaDesk />
      </main>
    </div>
  );
}
