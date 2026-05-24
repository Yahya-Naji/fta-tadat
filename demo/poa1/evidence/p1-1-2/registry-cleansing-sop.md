# SOP — Registry data quality & cleansing
_Illustrative standard operating procedure._

## Purpose
Keep the active register accurate by removing inactive, duplicate and invalid records and
flagging dormant taxpayers.

## Schedule (routine)
- **Monthly**: automated duplicate-detection run (match on Emirates ID / licence number / legal name).
- **Monthly**: dormancy flagging — accounts with no filing across consecutive periods are flagged.
- **Quarterly**: review queue worked by Taxpayer Records & Data Quality; confirmed cases
  deregistered/archived; duplicates merged.

## Third-party corroboration
- Active records are validated against the **licensing authorities** and **Emirates ID (ICP)**
  register. Cross-checks with additional sources are done **selectively / case-by-case** —
  not yet large-scale automated across every external database (improvement on the roadmap).

## Outputs
- Cleansing statistics reported to management (see `records-removed-2023-2024.csv`).
