# POA 1 demo pack — Layla (Integrity of the Registered Taxpayer Base)

Illustrative demo data (plausible, **not official FTA documents**). Use it to run
Layla end-to-end without real data.

## How to use
1. Open `/agents/registry`.
2. **Answers** → copy from [`ANSWERS.txt`](./ANSWERS.txt) into each question (checklist
   panel or chat interview).
3. **Evidence** → attach the matching file below on each "Requested evidence" row.
4. Click **Process evidence & score**.
5. Expected: P1-1-1 **A** · P1-1-2 **B** · P1-2 **B** → P1-1 **B** → **POA 1 = B**.

## File → evidence-row map

| Group | Evidence row | File |
|---|---|---|
| Background | Org chart + roles | `evidence/background/fta-org-chart.md` |
| Background | Core tax laws on registration | `evidence/background/core-tax-registration-law-extract.md` |
| P1-1-1 | Tax registration application form | `evidence/p1-1-1/emaratax-registration-form.md` |
| P1-1-1 | IT system + DB config map | `evidence/p1-1-1/emaratax-it-architecture.md` |
| P1-1-1 | Numbering-system spec | `evidence/p1-1-1/trn-numbering-spec.md` |
| P1-1-1 | **Movements in the Register** (dataset) | `evidence/p1-1-1/movements-in-register.csv` |
| P1-1-2 | Procedure: remove inactive/duplicate/invalid | `evidence/p1-1-2/registry-cleansing-sop.md` |
| P1-1-2 | Procedure: proof-of-identity | `evidence/p1-1-2/identity-verification-sop.md` |
| P1-1-2 | Stats of records removed (1–2 yrs) | `evidence/p1-1-2/records-removed-2023-2024.csv` |
| P1-1-2 | Internal/external audit report | `evidence/p1-1-2/internal-audit-registry-accuracy-2024.md` |
| P1-2 | Detection initiatives (done + planned) + sources | `evidence/p1-2/unregistered-detection-plan.md` |
| P1-2 | Stats of taxpayers added via detection | `evidence/p1-2/new-registrants-from-detection-2024.csv` |

**Field-observation / portal / live-demo rows** (no document) → use the **Note** button on
that row, e.g. *"EmaraTax officer view demonstrated — screenshot on file."*
