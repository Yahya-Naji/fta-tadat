/**
 * Real FTA anchor numbers, extracted directly from the open data XLSX files
 * downloaded from https://tax.gov.ae/en/open.data/open.data.aspx
 *
 * Files of record (in data/fta-aggregates/files/):
 *   - Selected Services Results.xlsx                  (annual totals 2017–2022)
 *   - Selected Services Results 2022 Jan to Dec.xlsx  (annual totals 2017–2022)
 *   - Approved VAT registeration.xlsx                 (VAT cumulative 2018–2021)
 *   - Excise Registerations.xlsx                      (Excise annual 2017–2021)
 *   - Open data 2025 full year - final.xlsx          (2025 quarterly + monthly)
 *   - All-services-Q3-2025.xlsx                      (May–Aug 2025 monthly)
 *   - Filnal-Q1-open-data.xlsx                       (2025 Q1 monthly)
 *   - No. of Excise tax registration 2023 - 2024.xlsx (2023–2024 by emirate)
 *   - Reconsideration Request approved by the FTA.xlsx (2021–2024 yearly + monthly)
 *   - No. of Inquiry Request submitted in the year of 2023 - 2024.xlsx
 *
 * Our calibrated synthetic data must match these numbers when aggregated
 * back up. Anything that doesn't add up to these is a bug in the seed.
 */

export interface AnchorYear {
  year: number;
  vatRegistrations?: number;        // VAT registrations approved that year
  vatDeregistrations?: number;      // VAT deregistrations that year
  exciseRegistrations?: number;     // Excise tax registrations that year
  corporateTaxRegistrations?: number; // CT registrations (CT introduced 2023)
  reconsiderations?: number;        // Reconsideration (dispute) requests approved
  inquiries?: number;               // Inquiry requests received
  complaints?: number;              // Complaints / feedback submitted
  homeBuilderRefunds?: number;      // VAT refunds for UAE national homebuilders
  vatAmendments?: number;
  cumulativeVatRegistrants?: number; // Running total of approved VAT regs
}

/** Annual real anchors */
export const FTA_ANNUAL: AnchorYear[] = [
  { year: 2017, vatRegistrations: 190_565, exciseRegistrations: 390 },
  {
    year: 2018,
    vatRegistrations: 77_537,
    vatDeregistrations: 1_692,
    exciseRegistrations: 126,
    cumulativeVatRegistrants: 266_067,
  },
  {
    year: 2019,
    vatRegistrations: 19_306,
    vatDeregistrations: 6_192,
    exciseRegistrations: 277,
    cumulativeVatRegistrants: 279_936,
  },
  {
    year: 2020,
    vatRegistrations: 18_746,
    vatDeregistrations: 1_907,
    exciseRegistrations: 348,
    homeBuilderRefunds: 2_598,
    cumulativeVatRegistrants: 297_181,
  },
  {
    year: 2021,
    vatRegistrations: 30_967,
    vatDeregistrations: 2_478,
    exciseRegistrations: 228,
    reconsiderations: 133,
    homeBuilderRefunds: 6_541,
    cumulativeVatRegistrants: 315_623,
  },
  {
    year: 2022,
    vatRegistrations: 25_751,
    vatDeregistrations: 1_212,
    exciseRegistrations: 247,
    reconsiderations: 4_232,
    homeBuilderRefunds: 5_995,
  },
  {
    year: 2023,
    exciseRegistrations: 217,        // by-emirate file
    reconsiderations: 1_157,
    inquiries: 313_412,
    complaints: 40_593,
  },
  {
    year: 2024,
    exciseRegistrations: 138,        // by-emirate file
    reconsiderations: 4_376,
    inquiries: 459_697,
    complaints: 76_795,
  },
  {
    year: 2025,
    vatRegistrations: 90_893,
    vatDeregistrations: 12_045,
    exciseRegistrations: 175,
    corporateTaxRegistrations: 227_263, // Massive — CT registration drive
    reconsiderations: 8_725,
    homeBuilderRefunds: 7_315,
    vatAmendments: 7_905,
  },
];

/**
 * Excise registrations by emirate (cumulative 2017–Q3 2023, from Excise 2023.xlsx).
 * Useful for industry/geography distribution sanity checks.
 */
export const EXCISE_BY_EMIRATE_CUMULATIVE: Record<string, number> = {
  Dubai: 1_186,
  "Abu Dhabi": 151,
  "Ras Al Khaimah": 80,
  Sharjah: 79,
  Ajman: 65,
  Fujairah: 30,
  "Other than Emirates": 18,
  "Umm Al Quwain": 13,
};

/**
 * Excise registrations by emirate for 2024 only (smaller, more recent picture).
 */
export const EXCISE_BY_EMIRATE_2024: Record<string, number> = {
  Dubai: 104,
  Sharjah: 10,
  "Abu Dhabi": 9,
  Ajman: 9,
  "Ras Al Khaimah": 2,
  "Umm Al Quwain": 2,
  "Other than Emirates": 2,
};

/**
 * Cumulative VAT registrants in UAE (latest known anchor). Used to size
 * the active-VAT-registrant universe for the POC.
 *
 * From "Selected Services Results 2022 Jan to Dec.xlsx" Final sheet:
 *   Total VAT Registrants 2017–2022 = 371,633 (gross approvals)
 * Less deregistrations 2018–2022 ≈ 13,481
 *   ≈ 358,000 active by end 2022.
 *
 * Real UAE FTA active VAT registrants are estimated >450,000 today (2025).
 * For the POC we model a representative sample, not the full population.
 */
export const ACTIVE_VAT_REGISTRANTS_UAE_ESTIMATE = 450_000;

/**
 * POC sample size — what we actually generate row-level. Calibrated so totals
 * scale linearly to the real anchors.
 */
export const POC_SAMPLE = {
  taxpayers: 1_000,
  // months of declaration/payment history we generate
  monthsOfHistory: 12,
} as const;

/** Emirates distribution, calibrated to UAE economy (Dubai + AbuDhabi dominate). */
export const EMIRATE_DISTRIBUTION: Record<string, number> = {
  Dubai: 0.46,
  "Abu Dhabi": 0.28,
  Sharjah: 0.10,
  Ajman: 0.05,
  "Ras Al Khaimah": 0.05,
  Fujairah: 0.03,
  "Umm Al Quwain": 0.02,
  "Other than Emirates": 0.01,
};

/** Industry distribution, weighted to UAE economy. */
export const INDUSTRY_DISTRIBUTION: Record<string, number> = {
  "Wholesale & Retail Trade": 0.24,
  "Real Estate": 0.14,
  "Construction": 0.11,
  "Professional Services": 0.10,
  "Hospitality & Tourism": 0.09,
  "Financial Services": 0.07,
  "Manufacturing": 0.07,
  "Transport & Logistics": 0.06,
  "Information & Communication": 0.05,
  "Oil, Gas & Mining": 0.03,
  "Healthcare": 0.02,
  "Education": 0.02,
};

/** Segment distribution. Large taxpayers contribute disproportionately to revenue. */
export const SEGMENT_DISTRIBUTION: Record<string, number> = {
  Large: 0.05,
  Medium: 0.20,
  Small: 0.45,
  Micro: 0.30,
};

/**
 * Seeded compliance conditions — used for ground-truth eval harness.
 * Each one targets a specific TADAT dimension and has a known expected score.
 * The seed generator must produce data that, when aggregated, matches these.
 */
export const SEEDED_CONDITIONS = {
  /** P1-1-2 Registry accuracy — duplicates + missing fields */
  registryDuplicates: 24,             // 2.4% of 1000 → contributes to score B/C
  registryMissingContact: 38,          // 3.8% missing email or phone
  registryDormantFlaggedActive: 18,    // status mismatch
  /** P4-13-3 VAT on-time filing rate (target ~87% → B) */
  vatOnTimeFilingRate: 0.87,
  /** P4-13-1 CIT on-time filing rate (target ~76% → B) */
  citOnTimeFilingRate: 0.76,
  /** P4-13-4 Excise on-time filing rate (target ~92% → A) */
  exciseOnTimeFilingRate: 0.92,
  /** P4-15 e-filing rate (target ~94% → A) */
  electronicFilingRate: 0.94,
  /** P5-18-1 VAT on-time payment by number (target ~84% → B) */
  vatOnTimePaymentRateByNumber: 0.84,
  /** P5-18-2 VAT on-time payment by value (target ~88% → B) */
  vatOnTimePaymentRateByValue: 0.88,
  /** P5-19-1 Total arrears / collections (target ~18% → B) */
  totalArrearsRatio: 0.18,
  /** P5-19-2 Collectible arrears / collections (target ~9% → B) */
  collectibleArrearsRatio: 0.09,
  /** P5-19-3 Arrears >12 months / total arrears (target ~32% → B) */
  oldArrearsRatio: 0.32,
  /** P5-16 e-payment adoption (target ~78% → A) */
  electronicPaymentRate: 0.78,
} as const;

/**
 * Tax due dates per UAE FTA rules:
 *   - VAT: 28th of month following period end
 *   - Excise: 15th of month following period end
 *   - Corporate Tax: 9 months after FY end (annual)
 */
export const STATUTORY_DUE_DAYS = {
  VAT: 28,        // day-of-month after period end
  EXCISE: 15,
  CT_MONTHS_AFTER_FY: 9,
} as const;

/** UAE VAT registration thresholds. */
export const VAT_THRESHOLDS_AED = {
  mandatory: 375_000,
  voluntary: 187_500,
} as const;
