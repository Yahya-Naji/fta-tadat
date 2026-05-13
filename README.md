# Quanterra · TADAT FTA Self-Assessment POC

Three Quanterra agents that score the **United Arab Emirates Federal Tax Authority** against the IMF's **Tax Administration Diagnostic Assessment Tool (TADAT)** — directly from registry, filing, payment, and arrears data.

| Agent | TADAT POA | What it does |
|---|---|---|
| **Registry Integrity Auditor** | POA 1 | Audits the taxpayer registry for completeness, duplicates, dormant-flag mismatches, and unregistered businesses. |
| **Filing Compliance Analyst** | POA 4 | Computes on-time filing rates per core tax (VAT, Excise, Corporate Tax) plus large-taxpayer sub-rates, e-filing adoption, and a non-filer worklist. |
| **Payments & Arrears Risk Agent** | POA 5 | Evaluates VAT on-time payment, electronic-payment adoption, and 3-year arrears trends with collectibility + aging analysis. |

---

## Architecture (matches the existing DDA-ISO Quanterra project)

```
   ┌─────────────┐    SQL pre-aggregation    ┌────────────┐
   │  Next.js    │ ────────────────────────▶ │  SQLite    │
   │  /api/      │  (lib/tadat/aggregations) │  tadat-    │
   │  agents/    │                           │  fta.db    │
   │  [id]/run   │ ◀──────────────────────── │            │
   └─────┬───────┘   pre-aggregated stats    └────────────┘
         │
         │ POST /api/autogen { query, team_id }
         ▼
   ┌──────────────────────────────────────────────┐
   │  Autogen backend (awedly-unstaid-marc.ngrok) │
   │   ├── tadat_registry_integrity_team          │
   │   ├── tadat_filing_compliance_team           │
   │   └── tadat_payments_arrears_team            │
   │   (each = 1 AssistantAgent, GPT-4o-mini)     │
   └──────────────────────────────────────────────┘
```

The LLM agent does **no SQL** — it receives a pre-computed JSON payload and only applies the TADAT scoring rubric + writes the narrative. This keeps numbers deterministic.

---

## Real data foundation

Database is calibrated against real, public UAE FTA aggregates.

| Source | What it gives us |
|---|---|
| [tax.gov.ae open-data portal](https://tax.gov.ae/en/open.data/open.data.aspx) | Annual & quarterly counts: VAT registrants, deregistrations, Corporate Tax registrants, Excise, reconsiderations, complaints, inquiries (2017–2025). Files downloaded into `data/fta-aggregates/files/`. |
| `data/seed/fta-anchors.ts` | All real numbers captured as TypeScript constants with file-of-record citations. |
| `data/seed/schema.sql` | SQLite schema covering taxpayers, declarations, payments, arrears, collections, plus a `fta_aggregates` table holding the real anchor numbers. |
| `scripts/seed.ts` | Generates 1,000 representative taxpayers + 12 months of declarations & payments, calibrated to seeded TADAT compliance conditions so eval has a known ground truth. |

Row-level taxpayer data is not, and never will be, public anywhere in the world (TADAT Field Guide p. 24 confirms confidentiality is universal). The hybrid approach used here — **real aggregates as anchors, synthetic row-level calibrated to them** — is what enterprise sovereign-AI POCs do for regulated customers.

---

## Setup

```bash
cd ~/Desktop/tadat-fta-poc

# 1. install deps
npm install

# 2. initialize SQLite + seed
npm run db:init       # creates data/tadat-fta.db
npm run db:seed       # ~6,000 declarations + payments + arrears
npm run db:verify     # confirms numbers match seeded conditions

# 3. configure environment
cp .env.local.example .env.local
# (already configured for the existing Quanterra Autogen / Keycloak instance)

# 4. deploy the 3 Quanterra team JSONs to Autogen — see next section
```

### Deploy the Quanterra teams (one-time)

The 3 team JSONs live in `quanterra_teams/`. Upload each to your Autogen backend the same way you deployed the DDA-ISO teams:

```bash
# Example via the Autogen API (replace path + token)
curl -X POST "$AUTOGEN_API_URL/api/teams/?user_id=$AUTOGEN_OVERRIDE_USER_ID" \
  -H "Authorization: Bearer $YOUR_KEYCLOAK_TOKEN" \
  -H "Content-Type: application/json" \
  -d @quanterra_teams/tadat_registry_integrity_team.json
```

The API returns the new `team_id`. Repeat for each of the 3 JSONs and put the IDs in `.env.local`:

```
AUTOGEN_TADAT_POA1_TEAM_ID=<id from registry team deployment>
AUTOGEN_TADAT_POA4_TEAM_ID=<id from filing team deployment>
AUTOGEN_TADAT_POA5_TEAM_ID=<id from payments team deployment>
```

### Run

```bash
npm run dev    # http://localhost:3001
```

You'll be redirected to Keycloak (realm: `quanterra`) to authenticate the same way as DDA-ISO. After login: home page → click an agent → **Run agent**.

---

## Evaluation (two layers)

### Layer 1 — deterministic rubric on aggregations
```bash
npm run eval
```
Confirms the SQL pre-aggregations produce TADAT-band-correct values. **Currently 21/21 passing.** This catches data-pipeline regressions instantly without burning LLM calls.

### Layer 2 — LLM scoring accuracy (manual)
Once team IDs are wired, hit each agent endpoint and compare its returned JSON to `eval/ground-truth.json`:
```bash
curl -X POST http://localhost:3001/api/agents/registry/run | jq .parsed
curl -X POST http://localhost:3001/api/agents/filing/run   | jq .parsed
curl -X POST http://localhost:3001/api/agents/payments/run | jq .parsed
```

---

## Repo layout

```
tadat-fta-poc/
├── app/
│   ├── page.tsx                       # Landing — 3 agent tiles
│   ├── data/page.tsx                  # DB snapshot + real FTA anchors
│   ├── agents/[id]/page.tsx           # Agent runner UI (preview + run)
│   └── api/
│       ├── agents/[id]/preview/       # GET pre-aggregated SQL inputs
│       ├── agents/[id]/run/           # POST → Autogen team
│       ├── autogen/route.ts           # Copied from DDA-ISO (PKCE + WS)
│       ├── auth/                      # Keycloak login/logout/callback
│       └── chat/calls/queryAutogenTeam.ts
├── lib/
│   ├── config.ts                      # Env-driven config (3 new team IDs)
│   ├── db.ts                          # SQLite singleton
│   ├── auth.ts | keycloak.ts | pkce.ts | autogenInit.ts | keycloakConfig.ts
│   └── tadat/
│       ├── rubric.ts                  # A/B/C/D thresholds (Field Guide 2025)
│       └── aggregations.ts            # 3 SQL pre-aggregators
├── quanterra_teams/                   # 3 team JSONs to deploy
├── data/
│   ├── fta-aggregates/files/*.xlsx    # Real data downloaded from tax.gov.ae
│   ├── seed/
│   │   ├── schema.sql                 # SQLite DDL
│   │   ├── fta-anchors.ts             # Real numbers + seeded conditions
│   │   ├── uae-names.ts               # Realistic UAE company name fragments
│   │   └── random.ts                  # Seeded RNG
│   └── tadat-fta.db                   # The seeded DB (gitignored)
├── scripts/
│   ├── inspect-fta-xlsx.ts            # Reads every xlsx → console
│   ├── init-db.ts                     # Creates DB from schema.sql
│   ├── seed.ts                        # Calibrated synthetic data
│   └── verify-db.ts                   # Sanity check via TADAT queries
├── eval/
│   ├── ground-truth.json              # Expected scores from seeded conditions
│   └── run-eval.ts                    # 21 deterministic checks
└── components/
    └── ScoreBadge.tsx
```

---

## Sources

- [UAE FTA Open Data Portal](https://tax.gov.ae/en/open.data/open.data.aspx) — every number in `data/seed/fta-anchors.ts` is downloadable from here
- [UAE FTA 2024 Annual Report](https://tax.gov.ae/Datafolder/Files/Pdf/2025/2024-annual-report-eng.pdf)
- IMF TADAT Field Guide 2025 — scoring rubric encoded in `lib/tadat/rubric.ts` and the 3 team JSONs
