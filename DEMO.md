# FTA · 2-minute TADAT demo

Five sovereign-AI agents, five TADAT 2025 POAs, one taxpayer journey. What
an IMF mission charges **AED 1–3M and 3 weeks** for, on demand, in seconds.

This is the click path. Everything below assumes the dev server is running
(`npm run dev`) and the SQLite DB is seeded.

---

## 0. Setup (one-time, ~30 sec)

```bash
cd ~/Desktop/tadat-fta-poc
npm install                # only if not already
npm run db:init            # fresh SQLite at data/tadat-fta.db
npm run db:seed            # ~6,000 declarations, payments, arrears
npm run dev                # http://localhost:3000
```

If a previous session left Next.js in a weird state:
`rm -rf .next && npm run dev`.

---

## 1. The 2-minute path

### Stop 1 — Landing (≤ 10 s) · `/`

> *"Five agents score the UAE FTA against the IMF TADAT 2025 framework —
> directly from FTA's own data, on demand."*

The hero shows the headline claim, three stat tiles (`5 POAs · ≤ 35s ·
AED 1–3M`), and a preview card on the right with the five agents already
scored from the canonical sample run.

Below the hero — the five personas as a row of cards:

| 01 Layla · POA 1 | 02 Hamad · POA 2 | 03 Maya · POA 3 | 04 Karim · POA 4 | 05 Salma · POA 5 |
|---|---|---|---|---|
| Register · **B** | Identify Risk · **C** | Make it Easy · **C** | File on Time · **B+** | Pay on Time · **B** |

Click **See the lifecycle** → `/lifecycle`.

### Stop 2 — Lifecycle (≤ 60 s) · `/lifecycle`

The page is **already populated** from the canonical sample run (that's
what `Sample run` chip in the header means). Five stage cards read
left-to-right with handoff arrows between them:

```
Register   →   Identify Risk   →   Make it Easy   →   File on Time   →   Pay on Time
 POA 1            POA 2                POA 3                POA 4              POA 5
 Layla            Hamad                Maya                 Karim              Salma
```

Each card carries: persona avatar · POA chip · stage verb · aggregate score
chip · one-sentence business outcome · three KPI sparks. Hover any score
chip — the tooltip cites the TADAT 2025 Field Guide page and lists the
constituent dim scores.

> *"This is what TADAT looks like wired to live data. Each card is one
> POA. Each agent owns its rubric chapter."*

Click **Run lifecycle** (top right). All five agents fire in parallel —
the cards transition `done → running → done` with a small gold shimmer at
the bottom of each running card. Wall-clock is the longest single agent
(typically 25–35 s).

The bottom **AggregatePanel** animates in: `AED 92.5M surfaced across the
5 POAs`. The disclaimer on that panel says `POA aggregate · UI convenience` —
TADAT itself doesn't define a POA-level rating; only indicators do. We
flag that explicitly with `is_tadat_defined: false` in the agent JSON.

### Stop 3 — Story mode (≤ 30 s) · same page

Click **Story mode** in the header. A full-screen takeover dims the
lifecycle and auto-advances through the five stages with a large caption
that narrates each handoff (every ~6.5 s). The closing slide animates the
aggregate AED.

ESC or click anywhere to exit.

> *"Story mode is the executive walkthrough — same data, narrated. Three
> minutes, no clicks."*

### Stop 4 — One agent in detail (≤ 20 s) · `/agents/filing`

Back on `/lifecycle`, click any **Open assessment** link.

- Karim (POA 4 / filing) opens the bespoke `/agents/filing` view —
  AED 92.5M hero, filing-rate gauges per core tax, 25-row non-filer
  worklist sortable by AED, draft assessment notice on row click.
- Layla, Hamad, Maya, Salma open the shared `AgentDetailView` shell:
  persona header · score chip · business outcome · KPI strip · indicator
  list with collapsible dim breakdown · pre-aggregate inputs (collapsed) ·
  raw response (collapsed). **Run live** in the header re-fires that one
  agent.

> *"Open any agent and you see the indicators that drove the score, with
> the field-guide reference behind every band."*

### Stop 5 — Upload (optional, ≤ 25 s) · `/upload`

From the landing nav, click **Upload**. Default sample is highlighted:
**Open data 2025 full year — final.xlsx**. Click it → click **Run pipeline**.

The page splits in two. Left: the pipeline ribbon (5 tiles) with handoff
pucks gliding between them as each upstream stage finishes. Right: a live
event log streamed from the SSE route at `/api/upload/run`, plus a detail
panel showing whichever tile is selected (auto-selects the first stage
that completes).

When the run finishes, the **SummaryPanel** animates the aggregate AED and
shows a per-POA score tape so a reviewer can drill straight into any agent.

> *"Drop your weekly FTA extract; the five agents fire end-to-end. SSE
> streams progress so you watch each tile light up in real time."*

---

## 2. Defensible questions

| Question | Answer |
|---|---|
| Are these scores real TADAT? | Yes — every indicator + dimension carries a `tadat_reference` citing Field Guide 2025 chapter and page. POA-level aggregate is a UI convenience, flagged `is_tadat_defined: false` in JSON. |
| Where does the data come from? | Open data CSVs from `tax.gov.ae/en/open.data` plus calibrated synthetic row-level taxpayer data (no jurisdiction publishes real row-level filings). |
| Why does POA 2's risk register list "transfer pricing"? | Source label `tadat-illustrative` — drawn from Field Guide Ch IV pg 42 to demonstrate the rubric. Real risks computed from POA 1/4/5 are labelled `data-derived`. A "Connect FTA Risk Register" CTA replaces them with FTA's internal data. |
| What if I disagree with a score? | Click any indicator → see the dim breakdown with `dim_kind` (quantitative / qualitative / mixed), the value, and the field-guide criterion that drove the band. Reproducible from the pre-aggregate inputs panel. |
| Can it run on FTA infra? | Same Azure OpenAI + Quanterra runtime the existing DDA-ISO project uses. No infra change. |

---

## 3. If something breaks mid-demo

| Symptom | Fix |
|---|---|
| Spinner forever on a stage | Stage timeout is 60 s. If hung: `rm -rf .next && npm run dev`. |
| `Cannot find module './X.js'` | Stale Next.js cache. `rm -rf .next && npm run dev`. |
| Aggregate AED stays at 0 after Run lifecycle | One of the agents (most often POA 3) returned a Zod warning that dropped a numeric field. Check the browser console; re-run that single agent from its detail page. |
| SSE stream stalls in `/upload` | Browser blocked event-stream — open `/api/upload/run` directly to confirm. Falls back gracefully if Azure rate-limits. |

---

## 4. Intentionally not in this build

- **Real file parsing.** The drop zone is theatrical — agents always read
  from the seeded SQLite. The pipeline UI and SSE stream are production-grade;
  the upload-to-DB ingestion path is a follow-up.
- **POA 6, 7, 8, 9 agents.** Same pattern, different chapters — slot in
  when prioritised.
- **Authentication.** Single-tenant POC; SSO + RBAC come with the FTA infra
  deployment.
