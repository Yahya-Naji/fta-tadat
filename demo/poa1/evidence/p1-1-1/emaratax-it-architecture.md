# EmaraTax — Registration IT subsystem (architecture overview)
_Illustrative high-level map._

## Platform
- Single, centralised national platform (EmaraTax). One register; no decentralised copies.

## The 6 TADAT IT-subsystem features
1. **Integration** — registration interfaces with filing and payment processing subsystems.
2. **Whole-of-taxpayer view** — officers see one taxpayer across VAT, Corporate Tax, Excise.
3. **Deactivation / deregistration + archive** — dormant accounts deactivated; deregistered records archived and restorable.
4. **Management information** — registration statistics by emirate, segment, sector, tax type.
5. **Audit trail** — every user access and data change is logged (user, timestamp, before/after).
6. **Secure online self-service** — taxpayers register and update details online, protected by **multi-factor authentication (MFA)**.

## Key integrations
- ICP (Emirates ID) — identity verification.
- Emirate licensing authorities (DET, ADDED) and free zones — entity validation.
- Customs — import data feed (used in detection, POA 1.2).

## Access control
- Role-based access; MFA for taxpayers and staff; full audit logging for internal-audit review.
