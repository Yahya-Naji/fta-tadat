"use client";

/**
 * UserSwitcher — top-right "signed in as ..." dropdown. Lets a reviewer
 * impersonate any of the 5 personas (Layla, Hamad, Maya, Karim, Salma)
 * to see that user's desk view. For the POC this is a vanilla switcher,
 * not real auth — production would gate by RBAC.
 */
import * as React from "react";
import { ChevronDown, UserCircle, Check } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { PERSONA_LIST, PERSONAS, type AgentId } from "@/lib/personas";
import { PersonaAvatar } from "@/components/PersonaAvatar";

export function UserSwitcher() {
  const { state, setCurrentUser, isHydrated } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Before hydration, render a neutral placeholder to avoid SSR mismatch.
  const current = isHydrated ? PERSONAS[state.currentUser] : null;

  function pick(id: AgentId) {
    setCurrentUser(id);
    setOpen(false);
    // If we're on an /agents/[x] page, navigate to the new persona's
    // department page so the URL + page content follow the switch.
    if (pathname?.startsWith("/agents/")) {
      router.push(`/agents/${id}`);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white pl-1 pr-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current ? (
          <>
            <PersonaAvatar persona={current} size={28} />
            <div className="text-left leading-tight">
              <div className="text-[12px] font-bold">{current.name}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                POA {current.poa}
              </div>
            </div>
          </>
        ) : (
          <>
            <UserCircle className="h-7 w-7 text-gray-400" />
            <div className="text-left leading-tight">
              <div className="text-[12px] font-bold">Signed in</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                —
              </div>
            </div>
          </>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e2128] shadow-xl shadow-black/10 dark:shadow-black/40 z-50 animate-fade-in overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
              Switch persona
            </p>
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-snug">
              Each persona is an FTA officer who owns one POA.
            </p>
          </div>
          <ul className="py-1 max-h-80 overflow-y-auto">
            {PERSONA_LIST.map((p) => {
              const isMe = state.currentUser === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isMe}
                    onClick={() => pick(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-white/5 ${
                      isMe
                        ? "bg-indigo-50/60 dark:bg-indigo-500/10"
                        : "hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <PersonaAvatar persona={p} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-gray-900 dark:text-white">
                          {p.name}
                        </span>
                        <span className={`text-[9px] font-mono uppercase tracking-wider ${p.accentText}`}>
                          POA {p.poa}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-gray-500 dark:text-gray-400 truncate">
                        {p.role}
                      </div>
                    </div>
                    {isMe && (
                      <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300 shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
