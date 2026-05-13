"use client";

/**
 * Landing — Q Task brand for the FTA POC.
 *
 *   1. Hero        — full-screen rotating image background, dark overlay,
 *                    gradient h1, stats strip, primary CTA.
 *   2. Solution    — three glass cards explaining what this product is.
 *   3. Roadmap     — five agent bubbles connected by a horizontal gradient
 *                    line. Each owns a TADAT POA. Layla → Hamad → Maya →
 *                    Karim → Salma. Click → /agents/{id}.
 *   4. Capabilities— three glass cards (continuous · field-guide grade ·
 *                    every score evidenced).
 *   5. CTA banner  — purple gradient banner with white pill button to
 *                    /dashboard and ghost button to /upload.
 */
import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Database,
  ShieldAlert,
  Sparkles,
  FileCheck2,
  Wallet,
  Zap,
  Brain,
  Layers,
  ShieldCheck,
  GitMerge,
  LayoutDashboard,
  Upload,
  CheckCircle,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { QTaskWordmark } from "@/components/QTaskLogo";
import { ScoreBadge } from "@/components/ScoreBadge";

// ─── Hero slides ──────────────────────────────────────────────────────────

type Slide = {
  code: string;
  title: string;
  focus: string;
  image: string;
  blurb: string;
};

const SLIDES: Slide[] = [
  {
    code: "POA 1",
    title: "Registry Integrity",
    focus: "Layla audits 1,024 TRNs",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80",
    blurb:
      "Every taxpayer in the system, scored for completeness — duplicates, missing contact, dormant flags.",
  },
  {
    code: "POA 2",
    title: "Risk Management",
    focus: "Hamad ranks AED 92.5M of risk",
    image:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80",
    blurb:
      "Compliance, operational, and human-capital risks — segmented and quantified for the worklist.",
  },
  {
    code: "POA 3",
    title: "Service & Facilitation",
    focus: "Maya measures the friction",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
    blurb:
      "Telephone wait, info-product currency, intermediary engagement, complaint volumes — every channel scored.",
  },
  {
    code: "POA 4",
    title: "On-Time Filing",
    focus: "Karim recovers AED 50M+",
    image:
      "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=80",
    blurb:
      "VAT, CT, Excise on-time rates with large-taxpayer breakouts and a non-filer worklist sorted by AED.",
  },
  {
    code: "POA 5",
    title: "Arrears & Payments",
    focus: "Salma stratifies AED 195M",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
    blurb:
      "VAT on-time payment by value, e-payment adoption, and the 3-year arrears trend with collectibility.",
  },
];

// ─── Agent roadmap ────────────────────────────────────────────────────────

interface AgentStep {
  id: string;
  poa: number;
  step: string;
  persona: string;
  role: string;
  blurb: string;
  href: string;
  icon: typeof Database;
  gradient: string;
  shadow: string;
  score: string;
}

const AGENTS: AgentStep[] = [
  {
    id: "registry",
    poa: 1,
    step: "Register",
    persona: "Layla",
    role: "Registry Integrity Auditor",
    blurb: "Audits the registry — duplicates, missing contact, dormant flags.",
    href: "/agents/registry",
    icon: Database,
    gradient: "from-indigo-500 to-violet-500",
    shadow: "shadow-indigo-500/30",
    score: "B",
  },
  {
    id: "risk",
    poa: 2,
    step: "Identify Risk",
    persona: "Hamad",
    role: "Compliance Risk Officer",
    blurb: "Ranks compliance + operational + human-capital risks by AED at risk.",
    href: "/agents/risk",
    icon: ShieldAlert,
    gradient: "from-rose-500 to-amber-500",
    shadow: "shadow-rose-500/30",
    score: "C",
  },
  {
    id: "service",
    poa: 3,
    step: "Make it Easy",
    persona: "Maya",
    role: "Service & Facilitation Lead",
    blurb: "Measures filing friction — channels, products, intermediaries.",
    href: "/agents/service",
    icon: Sparkles,
    gradient: "from-fuchsia-500 to-pink-500",
    shadow: "shadow-fuchsia-500/30",
    score: "C",
  },
  {
    id: "filing",
    poa: 4,
    step: "File on Time",
    persona: "Karim",
    role: "Filing Compliance Officer",
    blurb: "Scores VAT/CT/Excise on-time filing and ranks non-filers by AED.",
    href: "/agents/filing",
    icon: FileCheck2,
    gradient: "from-blue-500 to-cyan-500",
    shadow: "shadow-blue-500/30",
    score: "B+",
  },
  {
    id: "payments",
    poa: 5,
    step: "Pay on Time",
    persona: "Salma",
    role: "Arrears Risk Strategist",
    blurb: "Stratifies AED 195M arrears, scores e-payment + 3-yr arrears trend.",
    href: "/agents/payments",
    icon: Wallet,
    gradient: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/30",
    score: "B",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const [slide, setSlide] = React.useState(0);

  // Auto-advance hero every 6s
  React.useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const current = SLIDES[slide];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#282C34]">
      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section className="relative h-screen min-h-[700px] overflow-hidden">
        {/* Background slider */}
        {SLIDES.map((s, i) => (
          <div
            key={s.code}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === slide ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== slide}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.image}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ))}

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/50 to-violet-900/20" />

        {/* Header */}
        <header className="absolute top-0 inset-x-0 z-50 h-20 px-6 md:px-10">
          <div className="mx-auto max-w-7xl h-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QTaskWordmark forceLight />
              <span className="hidden md:inline text-white/30">|</span>
              <span className="hidden md:inline text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                FTA · TADAT 2025
              </span>
            </div>
            <nav className="flex items-center gap-2 md:gap-4 text-sm">
              <Link
                href="/dashboard"
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1.5 text-white/85 hover:bg-white/15 transition"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <Link
                href="/upload"
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1.5 text-white/85 hover:bg-white/15 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Link>
              <Link
                href="/desk"
                className="hidden md:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-3 py-1.5 text-white shadow-lg shadow-violet-500/30 hover:opacity-95 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sign in
              </Link>
              <ThemeToggle className="!border-white/20 !bg-white/10 !text-white !backdrop-blur-md hover:!bg-white/15" />
            </nav>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-7xl h-full px-6 md:px-10 flex items-center pt-20">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs text-white/85">
              <Zap className="h-3.5 w-3.5 text-violet-300" />
              <span className="font-semibold uppercase tracking-[0.18em]">
                Sovereign AI · TADAT 2025
              </span>
            </span>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
              {current.code} · {current.focus}
            </p>

            <h1 className="mt-3 text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight text-white">
              An IMF TADAT mission,{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                in seconds.
              </span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-white/70 max-w-2xl leading-relaxed">
              Five sovereign-AI agents score the UAE Federal Tax Authority
              against the TADAT 2025 framework — registry integrity, risk,
              service, on-time filing, on-time payment — continuously, on
              demand, against live FTA data.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-2xl shadow-indigo-500/30 hover:opacity-95 hover:-translate-y-0.5 transition"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-6 py-3 text-sm font-bold text-white hover:bg-white/15 transition"
              >
                <Upload className="h-4 w-4" />
                Upload sample
              </Link>
            </div>

            {/* Stats strip */}
            <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-lg p-1 max-w-2xl">
              <div className="grid grid-cols-3 divide-x divide-white/15">
                <Stat value="5" label="TADAT POAs" />
                <Stat value="< 35s" label="Wall-clock" />
                <Stat value="AED 1–3M" label="What IMF charges" />
              </div>
            </div>
          </div>
        </div>

        {/* Slide controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length)}
            className="rounded-full bg-black/40 backdrop-blur p-2.5 text-white/85 hover:bg-black/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === slide ? "w-8 bg-white" : "w-2 bg-white/35 hover:bg-white/55"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSlide((s) => (s + 1) % SLIDES.length)}
            className="rounded-full bg-black/40 backdrop-blur p-2.5 text-white/85 hover:bg-black/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-3 right-6 z-10 text-[10px] uppercase tracking-[0.22em] text-white/45 animate-fade-in">
          Scroll
        </div>
      </section>

      {/* ── 2. SOLUTION ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 dark:bg-[#1e2128] py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12 animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
              The solution
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              TADAT, made <span className="gradient-text">continuous</span>.
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Five AI agents apply the IMF TADAT 2025 rubric to live FTA data.
              Each agent owns a Performance Outcome Area; the lifecycle runs
              in parallel, end-to-end, in under a minute.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <SolutionCard
              icon={Brain}
              gradient="from-indigo-500 to-violet-500"
              shadow="shadow-indigo-500/30"
              title="Sovereign agents"
              body="Each agent runs on FTA infrastructure. No data leaves the perimeter; the TADAT 2025 rubric runs against the FTA's own SQL roll-ups."
            />
            <SolutionCard
              icon={Layers}
              gradient="from-fuchsia-500 to-pink-500"
              shadow="shadow-fuchsia-500/30"
              title="Five POAs, one journey"
              body="Register → Identify Risk → Make it Easy → File on Time → Pay on Time. Each agent's output feeds the next, mirroring the IMF mission flow."
            />
            <SolutionCard
              icon={Zap}
              gradient="from-emerald-500 to-teal-500"
              shadow="shadow-emerald-500/30"
              title="On demand, not periodic"
              body="An IMF mission samples one moment in time. Quanterra runs the same scoring on demand — daily, weekly, or after every policy change."
            />
          </div>
        </div>
      </section>

      {/* ── 3. AGENT ROADMAP ────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#282C34] py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-14 animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
              The agents
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              Five agents, one taxpayer journey.
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Click any step to open that agent&apos;s full assessment. Karim
              (POA 4) carries the bespoke worklist UX; the others share a
              shared assessment shell.
            </p>
          </div>

          {/* Roadmap row */}
          <div className="relative">
            {/* Horizontal connector — spans the bubbles row at md+ */}
            <div
              className="hidden md:block absolute top-[36px] left-[6%] right-[6%] h-px bg-gradient-to-r from-indigo-200 via-violet-200 to-pink-200 dark:from-indigo-500/40 dark:via-violet-500/40 dark:to-pink-500/40"
              aria-hidden
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-3 relative">
              {AGENTS.map((a, i) => (
                <RoadmapBubble key={a.id} agent={a} index={i} />
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-5 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
            >
              See the agents fire end-to-end
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. CAPABILITIES ─────────────────────────────────────────────── */}
      <section className="bg-gray-50 dark:bg-[#1a1d24] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12 animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
              Why this matters
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              The IMF rubric, the FTA timeline.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Capability
              icon={Zap}
              title="Continuous, not periodic"
              body="An IMF mission samples one moment in time. The pipeline runs the same scoring on demand."
            />
            <Capability
              icon={ShieldCheck}
              title="Field-Guide grade"
              body="Every indicator references the TADAT 2025 Field Guide page. M1 takes the lowest dim, M2 uses the conversion table — applied identically to the IMF assessor."
            />
            <Capability
              icon={GitMerge}
              title="Every score is evidenced"
              body="Pre-aggregated SQL roll-ups feed the LLM; the LLM applies the rubric and ships the dim-level evidence list. Open any score, see the SQL behind it."
            />
          </div>
        </div>
      </section>

      {/* ── 5. CTA BANNER ───────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#282C34] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-10 md:p-12 shadow-2xl shadow-indigo-500/20">
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
            <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-white/5" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                <Sparkles className="h-3 w-3" />
                Ready when you are
              </span>
              <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight text-white max-w-3xl leading-tight">
                Run an IMF-grade audit, on demand.
              </h2>
              <p className="mt-4 text-base md:text-lg text-white/80 max-w-2xl leading-relaxed">
                Open the dashboard to see live agent output, or upload a sample
                JSON to watch the five-agent pipeline fire end-to-end.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-700 hover:opacity-90 transition"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Open dashboard
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-6 py-3 text-sm font-bold text-white hover:bg-white/15 transition"
                >
                  <Upload className="h-4 w-4" />
                  Upload sample
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#1e2128]">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <QTaskWordmark />
            <span className="text-gray-300 dark:text-white/20">|</span>
            <span>Powered by Quanterra · TADAT 2025 Field Guide</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-white transition">Dashboard</Link>
            <Link href="/upload" className="hover:text-gray-900 dark:hover:text-white transition">Upload</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xl md:text-2xl font-bold text-white tabular-nums leading-tight">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
        {label}
      </div>
    </div>
  );
}

function SolutionCard({
  icon: Icon,
  gradient,
  shadow,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  shadow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-panel p-6 hover:-translate-y-1 transition-transform">
      <div
        className={`h-11 w-11 rounded-xl bg-gradient-to-br ${gradient} ${shadow} shadow-lg flex items-center justify-center mb-4`}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
    </div>
  );
}

function Capability({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-panel p-6">
      <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center mb-3 border border-indigo-100 dark:border-indigo-500/30">
        <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
    </div>
  );
}

function RoadmapBubble({ agent, index }: { agent: AgentStep; index: number }) {
  const Icon = agent.icon;
  return (
    <Link
      href={agent.href}
      className="group relative flex flex-col items-center text-center px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl"
    >
      <div className="relative mb-4">
        <div
          className={`relative h-[72px] w-[72px] rounded-full bg-gradient-to-br ${agent.gradient} ${agent.shadow} shadow-lg ring-4 ring-white dark:ring-[#282C34] flex items-center justify-center group-hover:-translate-y-1 transition-transform`}
        >
          <Icon className="h-7 w-7 text-white" />
        </div>
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-white dark:bg-[#282C34] border border-gray-200 dark:border-white/10 text-[10px] font-bold text-gray-700 dark:text-gray-200 font-mono tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
        POA {agent.poa}
      </p>
      <h3 className="mt-1 text-base font-bold text-gray-900 dark:text-white leading-tight">
        {agent.step}
      </h3>
      <p className="mt-0.5 text-[12px] text-gray-700 dark:text-gray-300">
        <span className="font-semibold">{agent.persona}</span>
        <span className="text-gray-400 dark:text-gray-500"> · {agent.role}</span>
      </p>
      <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400 leading-snug max-w-[200px]">
        {agent.blurb}
      </p>
      <div className="mt-3">
        <ScoreBadge score={agent.score} />
      </div>
    </Link>
  );
}
