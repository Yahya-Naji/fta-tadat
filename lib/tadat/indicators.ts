/**
 * TADAT 2025 Field Guide — indicator dictionary.
 *
 * Per-indicator: what it measures, scoring method (M1 lowest-of-dims /
 * M2 conversion table), the A/B/C/D criteria in plain English, and the
 * Field Guide chapter + page reference. Used by IndicatorPanel to render
 * the canonical definition next to whatever the agent emitted as evidence.
 *
 * Sourced from the IMF TADAT Field Guide 2025 — paraphrased for UI use.
 * Where dimensions exist, the parent indicator carries the M1/M2 rollup
 * rule and each dimension carries its own measurement description.
 */

export interface IndicatorBandCriteria {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface DimensionDefinition {
  dim_id: string;             // e.g. "P1-1-1"
  dim_name: string;
  measures: string;           // what the dim assesses
  bands: IndicatorBandCriteria;
  /** Assessor questions to put to the FTA for this dimension.
   *  Lifted from the Field Guide "Assessor Question Guidance" (Table 5 etc.). */
  questions?: string[];
  /** The specific evidence/documents the FTA must provide for this dimension.
   *  Lifted from the "Examples of evidence" column of the same table.
   *  This is what Layla requests ("upload your evidence") and scores against. */
  evidence_checklist?: string[];
}

export interface IndicatorDefinition {
  code: string;               // e.g. "P1-1"
  name: string;
  poa: 1 | 2 | 3 | 4 | 5;
  poa_name: string;
  scoring_method: "M1" | "M2";
  scoring_rule: string;       // 1-liner explaining the rollup
  measures: string;           // what the indicator as a whole assesses
  bands: IndicatorBandCriteria;
  field_guide_ref: string;    // "Field Guide 2025, Ch III, pg 27, 32–34"
  dimensions?: DimensionDefinition[];
  /** For single-dimension indicators (no `dimensions[]`), the assessor
   *  questions live here. For multi-dimension indicators they live on each
   *  dimension instead. */
  questions?: string[];
  /** Evidence checklist for single-dimension indicators (see above). */
  evidence_checklist?: string[];
}

/** POA-level "Background questions" — asked once before any dimension is
 *  scored (Field Guide Table 5 "Background questions" row). Keyed by POA. */
export interface BackgroundGuidance {
  questions: string[];
  evidence_checklist: string[];
}

export const POA_BACKGROUND: Record<number, BackgroundGuidance> = {
  1: {
    questions: [
      "Under the country's tax laws: who must register in respect of the core taxes, who can register voluntarily, and who is not permitted to register?",
      "What other government agencies are involved in registering businesses and individuals for tax purposes? What is their role, what interaction is there with the tax administration, and is registration information automatically shared between agencies?",
      "Which organizational unit(s) of the tax administration are responsible for registering businesses and individuals and maintaining the taxpayer registration database?",
    ],
    evidence_checklist: [
      "Core tax laws governing registration",
      "Website / published guidance on registration requirements for businesses and individuals",
      "Websites of other regulatory agencies involved in citizen, business, and corporate registration and numbering",
      "Organizational chart of the tax administration with role descriptions of the main units",
    ],
  },
};

// ─── POA 1 — Integrity of the Registered Taxpayer Base ──────────────────

const P1_1: IndicatorDefinition = {
  code: "P1-1",
  name: "Accurate and reliable taxpayer information",
  poa: 1,
  poa_name: "Integrity of the Registered Taxpayer Base",
  scoring_method: "M1",
  scoring_rule:
    "M1 — the indicator score equals the lowest of the constituent dimension scores (P1-1-1, P1-1-2).",
  measures:
    "Whether the registration database holds adequate, accurate taxpayer information and supports effective interactions with taxpayers, intermediaries, and other government agencies.",
  bands: {
    A: "Both dimensions score A — comprehensive fields on a central computerised database with a high-integrity TIN and a full-featured IT subsystem, kept accurate by routine, audited cleansing procedures.",
    B: "Lowest dimension is B (e.g. multiple linked TINs, no MFA, or post-registration ID checks at smaller cross-checking scale).",
    C: "Lowest dimension is C (decentralised database / some fields not recorded, or accuracy procedures applied only ad hoc).",
    D: "Lowest dimension is D — requirements for C not met, or evidence insufficient to assess.",
  },
  field_guide_ref: "Field Guide 2025, Ch III — Table 5 (pp 27–30), Table 6 (pp 31–33)",
  dimensions: [
    {
      dim_id: "P1-1-1",
      dim_name:
        "Adequacy of information held + extent the registration database supports effective interactions",
      measures:
        "Whether the database captures the required identifying/contact/obligation fields, runs on a central high-integrity-TIN system, and whether the registration IT subsystem provides the features needed to interact with taxpayers, intermediaries, and other agencies (Box 1).",
      bands: {
        // Field Guide Table 6, pp 31–32
        A: "All present: (i) required fields held — individuals: full name, address, contact details, gender, DOB, intermediary, filing/payment obligations; businesses: full name, business/registered + postal address, contact details, website, incorporation/registration date, nature of business activity, associated/related entities + beneficial owners, segment, industry sector, intermediary, filing/payment obligations; (ii) a central national computerised database; (iii) each taxpayer has a unique high-integrity TIN; (iv) the IT subsystem interfaces with other subsystems, gives a whole-of-taxpayer view across core taxes, allows deactivation/deregistration with restorable archiving, generates registration management information, provides an audit trail of access + changes, and offers secure online self-service with multi-factor authentication.",
        B: "As A, except taxpayers hold more than one high-integrity TIN (linked within the database) and/or secure online access does not require multi-factor authentication.",
        C: "As A, except details such as website, gender, or beneficial owner may not be recorded; the database is computerised but may be decentralised across sites (with TINs linked within each decentralised database).",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "For individuals, does the registration database hold: full name; address; contact details (telephone, email of the taxpayer and/or intermediary); date of birth; gender; and the filing & payment obligations for each core tax registered?",
        "For businesses, does it hold: full name; business and postal address; contact details (telephone, email, website); names and TINs of associated/related parties, grouped entities (incl. subsidiaries) and beneficial owners / persons with significant control; filing & payment obligations per core tax; date of incorporation or business registration; nature of business activity / industry sector (e.g. ISIC); and taxpayer segment (small/medium/large)?",
        "Is the registration database computerised or manual? Is it centralised (a single national database) or decentralised across regions/sites?",
        "What numbering system identifies taxpayers — a single unique high-integrity number used across all core taxes, or more than one (and are they linked)? Does the TIN carry a self-validating check digit?",
        "Does the registration IT subsystem: integrate with other subsystems (filing/payment); give frontline staff a whole-of-taxpayer view across all core taxes; allow deactivation of dormant registrations; allow deregistration and archiving that can be restored; generate registration management information; provide an audit trail of user access and changes; and provide secure online access to register and update details — with multi-factor authentication?",
      ],
      evidence_checklist: [
        "Field observation of the identifying/other information held for individuals and businesses",
        "The tax registration application form (and TIN issuance form)",
        "Documented high-level map of the IT system and registration database configuration",
        "Numbering-system policy / procedural documentation / IT specifications",
        "Demonstration of the IT subsystem by frontline staff",
        "Examples of registration management-information reports",
        "The taxpayer portal (online registration + self-update)",
        "Questionnaire Table 2 — Movements in the Taxpayer Register",
      ],
    },
    {
      dim_id: "P1-1-2",
      dim_name: "Accuracy of information held in the registration database",
      measures:
        "Whether documented procedures keep the active register accurate — removing inactive/duplicate/invalid records, verifying identity before registration, and cross-checking against third-party sources — with audit evidence of confidence in that accuracy.",
      bands: {
        // Field Guide Table 6, pp 32–33
        A: "All present: (i) documented procedures applied routinely to (a) identify + remove inactive/duplicate/invalid records and deactivate/flag dormant ones; (b) ensure applications are authentic, with proof-of-identity checks before registration is finalised; (c) verify accuracy via large-scale automated cross-checks against external agencies (registrar of companies, property cadastre, utilities, licensing, social security); and (ii) internal/external audit indicates a high level of confidence in registry accuracy for all core taxes.",
        B: "As A, except proof-of-identity checks for low-risk cases are carried out after registration, and cross-checking against other agencies is done on a smaller scale (e.g. case-by-case).",
        C: "As B but the documented procedures are applied only on an ad hoc basis; internal/external audit indicates a lower level of confidence (some reservations being addressed).",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Do documented national procedures exist to maintain the accuracy of the active register by identifying and removing inactive taxpayers (deceased/defunct), duplicate records, and false/invalid registrants — and are they applied routinely or only ad hoc?",
        "Do procedures ensure registration applications are authentic and applicants meet the legal requirements? Is proof of identity verified before registration is finalised (given VAT and income tax are refund-fraud targets), and how — electronic verification against external databases, manual paper/face-to-face checks, or a combination?",
        "Is information cross-checked against third-party sources (registrar of companies, property cadastre, utilities, licensing authorities) to keep it up to date? Is this routine or ad hoc, and done at large scale using automated processes? How is the accuracy of that third-party data itself established?",
        "What procedures review taxpayers who have failed to file in successive periods and update the register where they have become economically inactive or are no longer required to file?",
        "To what extent does the database give certainty about the number of active taxpayers per core tax? Has internal audit examined registry accuracy in the past 1–2 years (findings, recommendations, implementation)? Has the external auditor examined it?",
      ],
      evidence_checklist: [
        "Documented procedures: removal of inactive/duplicate/invalid records",
        "Documented procedures: proof-of-identity checks to prevent bogus registrations",
        "Documented procedures: use of third-party sources to verify accuracy",
        "Reports/management statistics of taxpayers removed over the past 1–2 years (evidence of regular planned cleansing)",
        "Internal or external audit reports on the accuracy and reliability of the registration database",
      ],
    },
  ],
};

const P1_2: IndicatorDefinition = {
  code: "P1-2",
  name: "Knowledge of the potential taxpayer base",
  poa: 1,
  poa_name: "Integrity of the Registered Taxpayer Base",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension; the indicator score is that dimension's score.",
  measures:
    "The extent of initiatives to detect businesses and individuals who are required to register but fail to do so.",
  bands: {
    // Field Guide Table 6, p 33
    A: "(i) The tax administration's annual operational plans specify detection initiatives including at least (a) systematic use of internal and third-party information sources (e.g. Customs, other government agencies, business registration/licensing, e-commerce platforms, social media, labour-force data, work-visa data, foreign jurisdictions) and (b) a programme of targeted risk-based activities using intelligence and/or technologies such as geolocalisation or remote sensing; and (ii) there is evidence (documented reports) of actions and results during the past year.",
    B: "As A but limited to the systematic third-party information sources (no targeted risk-based programme element); evidence of actions and results during the past year.",
    C: "Evidence exists only of ad hoc actions and results during the past year in detecting unregistered taxpayers.",
    D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
  },
  field_guide_ref: "Field Guide 2025, Ch III — Table 5 (p 30), Table 6 (p 33)",
  questions: [
    "Does the administration use third-party information to identify new business start-ups, digital service providers, online trading platforms, and economic activity of existing businesses that have failed to register?",
    "Does it use technology such as geolocalisation and/or remote-sensing imagery to identify potentially unregistered taxpayers?",
    "Does it review changes to the taxpayer register where the base has broadened (e.g. a VAT-threshold reduction) to identify new taxpayers and ensure they registered for all obligations?",
    "Does it make intelligence-led, risk-based unannounced visits to commercial districts to detect unregistered businesses and/or workers? What sources of intelligence drive those visits?",
    "Does it analyse online trading platforms to identify potentially non-registered persons or businesses?",
    "For initiatives undertaken in the past 1–2 years, were the outcomes monitored and reported upon?",
  ],
  evidence_checklist: [
    "Documented detection initiatives undertaken and planned",
    "Use of third-party sources (Customs, other government agencies, business registration/licensing, e-commerce platforms, social media, labour-force data, work-visa data, foreign-jurisdiction information)",
    "Management statistics of taxpayers added to the register over the past 1–2 years as a result of detection initiatives",
  ],
};

// ─── POA 2 — Effective Risk Management ──────────────────────────────────

const P2_3: IndicatorDefinition = {
  code: "P2-3",
  name: "Identification, assessment, ranking, and quantification of compliance risks",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule:
    "M1 — the indicator equals the lowest of its dimension scores.",
  measures:
    "How systematically the administration identifies, ranks and quantifies risks to revenue + voluntary compliance.",
  bands: {
    A: "Routine, modelled, intelligence-led risk identification across all major segments; risks ranked by AED at risk and probability; quarterly refresh.",
    B: "Periodic structured risk identification; main risks quantified.",
    C: "Some risk identification but not routine; predictive modelling is not used in case selection.",
    D: "No structured risk identification process.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV, pp 41–44 + 48–49",
  dimensions: [
    {
      dim_id: "P2-3-1",
      dim_name: "Process for risk identification",
      measures:
        "Is risk identification an institutionalised, routine process or a one-off exercise?",
      bands: {
        A: "Continuous, modelled, with explicit segments and triggers.",
        B: "Annual or semi-annual structured exercise.",
        C: "Ad-hoc, not routine, not modelled — predictive case selection not used.",
        D: "No process.",
      },
    },
    {
      dim_id: "P2-3-2",
      dim_name: "Range of intelligence sources",
      measures:
        "How many external sources feed the risk picture (banks, customs, licensing, social security, beneficial ownership, etc.)?",
      bands: {
        A: "≥5 external sources cross-feeding; data-sharing agreements in place.",
        B: "3–4 external sources used; some agreements.",
        C: "1–2 external sources, used inconsistently.",
        D: "No external intelligence used.",
      },
    },
  ],
};

const P2_4: IndicatorDefinition = {
  code: "P2-4",
  name: "Mitigation of risks through a Compliance Improvement Plan",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension.",
  measures:
    "Whether identified risks feed into a written Compliance Improvement Plan with owners, KPIs, deadlines.",
  bands: {
    A: "Documented CIP covering all major risks; owners and KPIs per action; refreshed annually.",
    B: "CIP exists for the most material risks; partial coverage of segments.",
    C: "Some mitigation activities but no consolidated CIP.",
    D: "No mitigation plan.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV, pp 44 + 49; Box 2 pg 37",
};

const P2_5: IndicatorDefinition = {
  code: "P2-5",
  name: "Monitoring and evaluation of compliance risk mitigation activities",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension.",
  measures:
    "Whether the impact of risk-mitigation activities is measured ex-post and reported up.",
  bands: {
    A: "Quarterly KPI review by senior leadership; lessons feed back into the next CIP.",
    B: "Periodic ex-post review of impact.",
    C: "Some monitoring but no formal evaluation loop.",
    D: "No monitoring of risk-mitigation outcomes.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV, pp 45 + 49–50",
};

const P2_6: IndicatorDefinition = {
  code: "P2-6",
  name: "Identification, assessment, and mitigation of institutional risks",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule: "M1 — the indicator equals the lowest of its dimension scores.",
  measures:
    "How the administration manages operational risks (IT outages, fraud, BCP, data loss).",
  bands: {
    A: "Documented operational-risk register + BCP; quarterly tabletop exercises.",
    B: "Operational-risk register exists with periodic review.",
    C: "Some operational risks tracked but not systematically.",
    D: "No operational-risk management.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV, pp 45–46 + 50–51",
  dimensions: [
    {
      dim_id: "P2-6-1",
      dim_name: "Identification and assessment of operational risks",
      measures: "Are operational risks logged, scored, and prioritised?",
      bands: {
        A: "Comprehensive operational-risk register with quantified impact.",
        B: "Operational-risk register exists; partial impact assessment.",
        C: "Ad-hoc tracking of operational risks.",
        D: "No operational-risk identification.",
      },
    },
    {
      dim_id: "P2-6-2",
      dim_name: "Mitigation of operational risks",
      measures: "Are mitigations in place + tested (BCP, redundancy, vendor risk)?",
      bands: {
        A: "BCP tested quarterly; redundant IT; vendor SLAs monitored.",
        B: "BCP exists + occasionally tested.",
        C: "Some mitigations exist; not regularly tested.",
        D: "No operational-risk mitigation.",
      },
    },
  ],
};

const P2_7: IndicatorDefinition = {
  code: "P2-7",
  name: "Identification, assessment, and mitigation of human capital risks",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule: "M1 — the indicator equals the lowest of its dimension scores.",
  measures:
    "How the administration manages workforce risks (staff turnover, skills gaps, succession).",
  bands: {
    A: "Documented HCR register + skills-gap analysis; succession plans for key roles.",
    B: "HCR register exists; some succession planning.",
    C: "Some HCR awareness; no formal plan.",
    D: "No HCR management.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV, pp 47 + 51–52",
  dimensions: [
    {
      dim_id: "P2-7-1",
      dim_name: "Identification and assessment of HCR",
      measures: "Are HCRs systematically tracked (turnover, skills gaps, key-person dependency)?",
      bands: {
        A: "Quarterly HCR review with metrics.",
        B: "Annual HCR assessment.",
        C: "Ad-hoc HCR awareness.",
        D: "No HCR tracking.",
      },
    },
    {
      dim_id: "P2-7-2",
      dim_name: "Mitigation of HCR",
      measures: "Are mitigations in place (training, succession, retention programmes)?",
      bands: {
        A: "Documented training + succession plans for all key roles.",
        B: "Training + partial succession plans.",
        C: "Some training; succession ad-hoc.",
        D: "No HCR mitigation.",
      },
    },
  ],
};

// ─── POA 3 — Supporting and Facilitating Compliance ─────────────────────

const P3_8: IndicatorDefinition = {
  code: "P3-8",
  name: "Scope, currency, and accessibility of information",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M1",
  scoring_rule: "M1 — lowest of dimensions.",
  measures:
    "Whether taxpayer-facing info products are complete, current, and easy to access.",
  bands: {
    A: "All info products complete, refreshed at every legislative change, available in ≥2 languages on multiple channels.",
    B: "Most info products current; minor gaps.",
    C: "Info products partial or outdated; rely heavily on phone for clarification.",
    D: "Info products outdated or missing.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 56–58 + 62–63",
  dimensions: [
    {
      dim_id: "P3-8-1",
      dim_name: "Scope of information",
      measures: "Does info cover every core obligation (register, file, pay, refund, audit)?",
      bands: {
        A: "100% coverage of obligations.",
        B: "90%+ coverage; minor gaps.",
        C: "75–90% coverage.",
        D: "Less than 75%.",
      },
    },
    {
      dim_id: "P3-8-2",
      dim_name: "Currency of information",
      measures: "Are info products refreshed when legislation changes?",
      bands: {
        A: "Refreshed within 30 days of every legislative change.",
        B: "Refreshed within 90 days.",
        C: "Refreshed within 6 months.",
        D: "Stale info products in market.",
      },
    },
    {
      dim_id: "P3-8-3",
      dim_name: "Ease of access",
      measures: "Are info products discoverable on the portal, via search, mobile?",
      bands: {
        A: "Findable in ≤3 clicks; mobile-optimised; search works.",
        B: "Findable in ≤5 clicks; mobile-optimised.",
        C: "Findable but requires navigation knowledge.",
        D: "Hard to find.",
      },
    },
  ],
};

const P3_9: IndicatorDefinition = {
  code: "P3-9",
  name: "Time taken to respond to information requests",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M2",
  scoring_rule:
    "M2 — apply the 2-dimension conversion table from the Field Guide to derive the indicator score (may yield A, B+, B, C+, C, D+, D).",
  measures:
    "Telephone P50 wait time + written-response turnaround. Both contribute via M2.",
  bands: {
    A: "Telephone P50 ≤ 6 min AND written response within 14 calendar days for ≥95% of requests.",
    B: "Telephone P50 ≤ 8 min AND written response within 21 calendar days for ≥90%.",
    C: "Telephone P50 ≤ 10 min OR written response within 30 calendar days for ≥80%.",
    D: "Worse than C bands.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 58–59 + 63–64",
  dimensions: [
    {
      dim_id: "P3-9-1",
      dim_name: "Telephone response time (P50)",
      measures: "Median wait time on the taxpayer hotline.",
      bands: {
        A: "≤ 6 minutes.",
        B: "6.1 to 8 minutes.",
        C: "8.1 to 10 minutes.",
        D: "More than 10 minutes.",
      },
    },
    {
      dim_id: "P3-9-2",
      dim_name: "Written-request response time",
      measures: "Share of written info requests answered within the SLA.",
      bands: {
        A: "≥95% within 14 days.",
        B: "≥90% within 21 days.",
        C: "≥80% within 30 days.",
        D: "Worse than C.",
      },
    },
  ],
};

const P3_10: IndicatorDefinition = {
  code: "P3-10",
  name: "Scope of initiatives to reduce taxpayer compliance costs",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension.",
  measures:
    "Programmes that simplify obligations or reduce time/cost for taxpayers (pre-filling, simplified regimes, tax agents, intermediary engagement).",
  bands: {
    A: "Multiple active programmes; measured cost-reduction outcomes.",
    B: "Active programmes; partial measurement of outcomes.",
    C: "Some programmes; no measurement.",
    D: "No active compliance-cost reduction programmes.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 59 + 64–65",
};

const P3_11: IndicatorDefinition = {
  code: "P3-11",
  name: "Obtaining taxpayer feedback on services",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M1",
  scoring_rule: "M1 — lowest of dimensions.",
  measures: "Whether the administration listens to taxpayers + acts on what it hears.",
  bands: {
    A: "Multiple feedback channels in routine use; documented action on findings.",
    B: "Feedback channels exist; some action.",
    C: "Limited feedback collection.",
    D: "No feedback channels.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 60 + 65–66",
  dimensions: [
    {
      dim_id: "P3-11-1",
      dim_name: "Use of feedback methods",
      measures: "How many channels (surveys, panels, complaint-line analytics) feed leadership?",
      bands: {
        A: "≥3 channels routinely used.",
        B: "2 channels routinely used.",
        C: "1 channel.",
        D: "No structured feedback.",
      },
    },
    {
      dim_id: "P3-11-2",
      dim_name: "Acting on feedback",
      measures: "Are improvements demonstrably driven by taxpayer feedback?",
      bands: {
        A: "Documented improvements per feedback cycle.",
        B: "Some improvements traceable to feedback.",
        C: "Feedback collected but rarely actioned.",
        D: "Feedback not acted on.",
      },
    },
  ],
};

const P3_12: IndicatorDefinition = {
  code: "P3-12",
  name: "Initiatives to encourage accurate reporting",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension.",
  measures:
    "Programmes that proactively help taxpayers report correctly the first time (cooperative compliance, large-taxpayer engagement, advance rulings, education campaigns).",
  bands: {
    A: "Active cooperative-compliance arrangements with large taxpayers; advance-ruling regime; targeted education programmes.",
    B: "Some cooperative compliance + ruling regime.",
    C: "Limited proactive engagement.",
    D: "No proactive engagement programmes.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 61 + 66",
};

// ─── POA 4 — Timely Filing ──────────────────────────────────────────────

const P4_13: IndicatorDefinition = {
  code: "P4-13",
  name: "On-time filing rate",
  poa: 4,
  poa_name: "Timely Filing of Tax Declarations",
  scoring_method: "M2",
  scoring_rule:
    "M2 — apply the multi-tax conversion table (VAT, Excise, CT + large-taxpayer breakouts).",
  measures:
    "Share of expected returns filed by the statutory deadline, by core tax + large-taxpayer cohort.",
  bands: {
    A: "≥90% on-time for every core tax AND for the large-taxpayer cohort.",
    B: "≥85% on-time across core taxes; large-taxpayer cohort ≥90%.",
    C: "≥70% on-time across core taxes.",
    D: "Worse than 70% on-time for any core tax.",
  },
  field_guide_ref: "Field Guide 2025, Ch VI, pg 73",
};

const P4_14: IndicatorDefinition = {
  code: "P4-14",
  name: "Management of non-filers",
  poa: 4,
  poa_name: "Timely Filing of Tax Declarations",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension.",
  measures:
    "Whether the administration tracks non-filers, ranks them by revenue impact, and pursues recovery systematically.",
  bands: {
    A: "Automated non-filer worklist refreshed daily; ranked by AED outstanding; documented recovery workflow with KPIs.",
    B: "Non-filer worklist refreshed weekly; ranked; recovery workflow exists.",
    C: "Non-filer list exists but is not routinely worked or ranked.",
    D: "No systematic non-filer management.",
  },
  field_guide_ref: "Field Guide 2025, Ch VI, pg 75",
};

const P4_15: IndicatorDefinition = {
  code: "P4-15",
  name: "Use of electronic filing facilities",
  poa: 4,
  poa_name: "Timely Filing of Tax Declarations",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension.",
  measures: "Share of declarations filed electronically across all core taxes.",
  bands: {
    A: "≥95% of declarations filed electronically.",
    B: "≥85% electronic.",
    C: "≥70% electronic.",
    D: "Less than 70% electronic.",
  },
  field_guide_ref: "Field Guide 2025, Ch VI, pg 76",
};

// ─── POA 5 — Timely Payment ─────────────────────────────────────────────

const P5_16: IndicatorDefinition = {
  code: "P5-16",
  name: "Use of electronic payment methods",
  poa: 5,
  poa_name: "Timely Payment of Taxes",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension.",
  measures: "Share of tax payments made electronically.",
  bands: {
    A: "≥95% e-payment.",
    B: "≥80% e-payment.",
    C: "≥60% e-payment.",
    D: "Less than 60% e-payment.",
  },
  field_guide_ref: "Field Guide 2025, Ch VII, pg 84",
};

const P5_18: IndicatorDefinition = {
  code: "P5-18",
  name: "Timeliness of payments",
  poa: 5,
  poa_name: "Timely Payment of Taxes",
  scoring_method: "M1",
  scoring_rule: "M1 — lowest of dimensions.",
  measures:
    "Share of payments received by the statutory due date, by number AND by value (for the largest tax).",
  bands: {
    A: "≥90% on-time by number AND ≥90% on-time by value.",
    B: "≥85% on-time by number AND ≥85% by value.",
    C: "≥70% on-time by number AND ≥70% by value.",
    D: "Less than 70% on-time by either measure.",
  },
  field_guide_ref: "Field Guide 2025, Ch VII, pg 85",
  dimensions: [
    {
      dim_id: "P5-18-1",
      dim_name: "VAT on-time payment — by number",
      measures: "Number of VAT payments received by the statutory due date / total expected.",
      bands: {
        A: "≥90%.",
        B: "85–90%.",
        C: "70–85%.",
        D: "<70%.",
      },
    },
    {
      dim_id: "P5-18-2",
      dim_name: "VAT on-time payment — by value",
      measures: "Value of VAT received on-time / total VAT due.",
      bands: {
        A: "≥90%.",
        B: "85–90%.",
        C: "70–85%.",
        D: "<70%.",
      },
    },
  ],
};

const P5_19: IndicatorDefinition = {
  code: "P5-19",
  name: "Stock and flow of tax arrears",
  poa: 5,
  poa_name: "Timely Payment of Taxes",
  scoring_method: "M2",
  scoring_rule:
    "M2 — 3-dimension conversion table (stock-vs-collections, old-arrears share, 3-year trend).",
  measures:
    "Health of the arrears book — how big it is, how aged, and whether it's growing.",
  bands: {
    A: "Arrears stock ≤ 5% of collections; old (>1 yr) ≤ 25% of stock; 3-yr trend declining.",
    B: "Stock ≤ 10%; old ≤ 40%; trend flat or declining.",
    C: "Stock 10–25%; old 40–60%; mixed trend.",
    D: "Stock > 25% or growing.",
  },
  field_guide_ref: "Field Guide 2025, Ch VII, pp 86–87",
  dimensions: [
    {
      dim_id: "P5-19-1",
      dim_name: "Stock of arrears relative to collections",
      measures: "Year-end arrears divided by total collections that year.",
      bands: {
        A: "≤ 5%.",
        B: "5–10%.",
        C: "10–25%.",
        D: "> 25%.",
      },
    },
    {
      dim_id: "P5-19-2",
      dim_name: "Old-arrears share",
      measures: "Arrears older than 12 months as a share of the total arrears stock.",
      bands: {
        A: "≤ 25%.",
        B: "25–40%.",
        C: "40–60%.",
        D: "> 60%.",
      },
    },
    {
      dim_id: "P5-19-3",
      dim_name: "3-year arrears trend",
      measures: "Direction of the arrears stock over the past 3 years.",
      bands: {
        A: "Clearly declining.",
        B: "Flat or marginally declining.",
        C: "Mixed.",
        D: "Growing.",
      },
    },
  ],
};

// ─── Index ──────────────────────────────────────────────────────────────

const ALL: IndicatorDefinition[] = [
  P1_1, P1_2,
  P2_3, P2_4, P2_5, P2_6, P2_7,
  P3_8, P3_9, P3_10, P3_11, P3_12,
  P4_13, P4_14, P4_15,
  P5_16, P5_18, P5_19,
];

export const TADAT_INDICATORS: Record<string, IndicatorDefinition> = Object.fromEntries(
  ALL.map((i) => [i.code, i]),
);

/**
 * Look up an indicator definition by code OR by a dimension id like "P1-1-2".
 * Dimension ids return their parent indicator.
 */
export function findIndicator(idOrCode: string): IndicatorDefinition | null {
  if (TADAT_INDICATORS[idOrCode]) return TADAT_INDICATORS[idOrCode];
  // P1-1-2 → P1-1
  const parent = idOrCode.split("-").slice(0, 2).join("-");
  return TADAT_INDICATORS[parent] ?? null;
}

/**
 * Look up a single dimension definition by its dim_id (e.g. "P1-1-2").
 */
export function findDimension(dimId: string): DimensionDefinition | null {
  const parent = findIndicator(dimId);
  if (!parent || !parent.dimensions) return null;
  return parent.dimensions.find((d) => d.dim_id === dimId) ?? null;
}
