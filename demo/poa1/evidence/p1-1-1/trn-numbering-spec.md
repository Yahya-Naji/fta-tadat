# Tax Registration Number (TRN) — numbering specification
_Illustrative spec._

## Principles
- **One unique TRN per taxpayer**, used across ALL core taxes (VAT, Corporate Tax, Excise).
  There are no separate per-tax numbers.
- High-integrity: the TRN is system-generated, never reused, and validated on every transaction.

## Format
- 15 digits.
- The final digit is a **self-validating check digit** (modulus check) that detects
  mistyped or invalid numbers at point of entry.

## Controls
- Duplicate prevention: a person/entity already holding a TRN cannot obtain a second one
  (matched on Emirates ID / licence number).
- The TRN links related parties, group members and branches to the principal taxpayer.
- Check-digit validation is enforced in registration, filing, payment and portal flows.
