/**
 * TADAT 2025 Field Guide scoring thresholds for the 3 POAs in this POC.
 * Used both to pre-compute expected scores for the eval harness and to
 * validate / sanity-check what the Quanterra agent returns.
 *
 * Reference: docs at tax.gov.ae and IMF TADAT Field Guide 2025.
 */

export type Score = "A" | "B" | "C" | "D" | "B+" | "C+" | "D+";

/**
 * "Higher is better" thresholds — three numbers in DESCENDING order [A, B, C].
 * value ≥ A → 'A',  ≥ B → 'B',  ≥ C → 'C',  else 'D'.
 */
export function scoreHigherBetter(
  value: number | null,
  thresholds: [number, number, number]
): Score {
  if (value == null || Number.isNaN(value)) return "D";
  if (value >= thresholds[0]) return "A";
  if (value >= thresholds[1]) return "B";
  if (value >= thresholds[2]) return "C";
  return "D";
}

/**
 * "Lower is better" thresholds — three numbers in ASCENDING order [A, B, C].
 * value < A → 'A',  < B → 'B',  < C → 'C',  else 'D'.
 */
export function scoreLowerBetter(
  value: number | null,
  thresholds: [number, number, number]
): Score {
  if (value == null || Number.isNaN(value)) return "D";
  if (value < thresholds[0]) return "A";
  if (value < thresholds[1]) return "B";
  if (value < thresholds[2]) return "C";
  return "D";
}

/** Worst (lowest) of a list of scores — used for M1 aggregation. */
export function worstScore(scores: Score[]): Score {
  const order: Score[] = ["A", "B+", "B", "C+", "C", "D+", "D"];
  let worst: Score = "A";
  for (const s of scores) {
    if (order.indexOf(s) > order.indexOf(worst)) worst = s;
  }
  return worst;
}

// =========================================================================
//   POA 1 — Registry Integrity
// =========================================================================
export const RUBRIC_POA1 = {
  // P1-1-2 Accuracy: composite of multiple signals; thresholds applied per
  // signal then combined with worstScore.
  duplicateRate: {
    label: "Duplicate / soft-duplicate records as % of total",
    higherIsBetter: false,
    thresholds: [0.005, 0.02, 0.05] as [number, number, number],
  },
  missingContactRate: {
    label: "Records missing email or phone (%)",
    higherIsBetter: false,
    thresholds: [0.01, 0.05, 0.1] as [number, number, number],
  },
  dormantMismatchRate: {
    label: "Active status with no filings in 24 months (%)",
    higherIsBetter: false,
    thresholds: [0.01, 0.03, 0.07] as [number, number, number],
  },
} as const;

// =========================================================================
//   POA 4 — On-Time Filing
// =========================================================================
export const RUBRIC_POA4 = {
  // P4-13-x  on-time filing rate (all taxpayers)
  onTimeAll: {
    higherIsBetter: true,
    thresholds: [90, 75, 50] as [number, number, number],
  },
  // P4-13-x  large-taxpayer band (per dimension)
  onTimeLarge: {
    higherIsBetter: true,
    thresholds: [100, 95, 90] as [number, number, number],
  },
  // P4-15  e-filing
  eFiling: {
    higherIsBetter: true,
    thresholds: [85, 70, 50] as [number, number, number],
  },
} as const;

// =========================================================================
//   POA 5 — Payments & Arrears
// =========================================================================
export const RUBRIC_POA5 = {
  // P5-16  e-payment
  ePaymentAll: { higherIsBetter: true, thresholds: [75, 50, 25] as [number, number, number] },
  ePaymentLarge: { higherIsBetter: true, thresholds: [100, 90, 80] as [number, number, number] },
  // P5-18  on-time payment (number / value) — same bands as P4-13
  onTimePay: { higherIsBetter: true, thresholds: [90, 75, 50] as [number, number, number] },
  // P5-19  arrears (lower is better)
  totalArrearsRatio: { higherIsBetter: false, thresholds: [10, 20, 40] as [number, number, number] },
  collectibleArrearsRatio: { higherIsBetter: false, thresholds: [5, 10, 20] as [number, number, number] },
  oldArrearsRatio: { higherIsBetter: false, thresholds: [25, 50, 75] as [number, number, number] },
} as const;
