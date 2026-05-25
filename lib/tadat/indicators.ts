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
  2: {
    questions: [
      "Which organizational unit(s) of the tax administration are responsible for setting risk-management policy and overseeing its implementation?",
      "Are any active committees of senior managers in place to manage compliance and/or operational risks?",
    ],
    evidence_checklist: [
      "Organizational chart of the tax administration with role descriptions of the main units",
      "Charters or terms of reference for the compliance, operational, or other relevant risk-management committees",
    ],
  },
  3: {
    questions: [
      "Which organizational unit(s) of the tax administration are responsible for taxpayer services, education, and communications, and is there a documented taxpayer-services / communication strategy that guides them?",
      "Through which channels does the administration deliver information and services to taxpayers (website, online portal, contact centre/telephone, in person, email, social media, mobile app)?",
    ],
    evidence_checklist: [
      "Organizational chart with the taxpayer-services, education, and communications units",
      "The taxpayer-services / education / communication strategy (or taxpayer charter)",
      "List of service and information channels offered to taxpayers, and the languages supported",
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
    "M1 — the indicator equals the lowest of its dimension scores (P2-3-1, P2-3-2).",
  measures:
    "Whether the administration gathers intelligence to identify compliance risks across the main tax obligations, and uses a structured process to assess, rank and quantify them.",
  bands: {
    A: "Both dimensions A — advanced-analytics intelligence from a wide range of internal + external sources, and a structured risk-assessment process embedded in multi-year strategic planning covering all core taxes, the four obligations, key segments and major sectors.",
    B: "Lowest dimension is B.",
    C: "Lowest dimension is C.",
    D: "Lowest dimension is D — requirements for C not met, or evidence insufficient.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV — Table 8 (pp 41–43), Table 9 (pp 47–48)",
  dimensions: [
    {
      dim_id: "P2-3-1",
      dim_name: "Extent of intelligence gathering and research to identify compliance risks",
      measures:
        "Whether the administration builds knowledge of compliance levels and current/emerging risks across core taxes, segments and the four obligations, using internal and external data.",
      bands: {
        // Field Guide Table 9, p 47
        A: "Builds knowledge of compliance levels and emerging risks by: (i) analysing environmental scans done as part of multi-year strategic planning; (ii) gathering + interpreting bulk external data using advanced analytics (predictive modeling, bunching analysis, machine learning) from banks/financial institutions, Customs and other government agencies, other tax jurisdictions and topical issues; and (iii) interpreting internal data (tax audits, declarations, fiscal registers/e-invoicing, tax-compliance-gap studies, taxpayer-behaviour studies).",
        B: "As A but bulk external data uses basic analysis methods, and internal sources exclude tax-compliance-gap studies.",
        C: "Intelligence-gathering and research is less comprehensive and mostly limited to internal, Customs and other government-agency sources.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Does the administration undertake intelligence gathering and research to build knowledge of compliance levels and risks across core taxes, taxpayer segments and the four obligations (registration, filing, payment, accurate reporting)?",
        "Does it analyse the results of environmental scans done as part of multi-year strategic planning, and analyse tax declarations and financial statements?",
        "Does it analyse audit results, including results from random audits run to test compliance across a representative sample of the target population?",
        "Does it research hidden economic activity, and study topical compliance issues (transfer pricing/profit shifting, aggressive tax planning by high-wealth/high-income taxpayers, use of crypto assets)?",
        "Does it analyse environmental factors that influence taxpayer behaviour (business, industry, sociological, economic, psychological)?",
        "Does it apply analytics (data analytics, predictive modeling, bunching analysis, machine learning) to bulk third-party data (banks/financial institutions, stock exchange, anti-money-laundering agency, property cadastre) and data from automatic exchange of information?",
      ],
      evidence_checklist: [
        "Documented analysis of environmental scans from strategic planning",
        "Random-audit program(s) to test compliance levels",
        "Analysis of tax declarations and financial statements",
        "Transfer-pricing / profit-shifting studies",
        "Studies into the tax-planning practices of high-wealth/high-income taxpayers",
        "Research into hidden economic activity",
        "Studies into environmental factors affecting taxpayer behaviour",
        "Analysis of third-party information + exchange-of-information / mutual-assistance agreements",
      ],
    },
    {
      dim_id: "P2-3-2",
      dim_name: "Process used to assess, rank, and quantify taxpayer compliance risks",
      measures:
        "Whether a structured risk-assessment process assesses and prioritises compliance risks across taxes, obligations, segments and sectors, and quantifies revenue at risk.",
      bands: {
        // Field Guide Table 9, pp 47–48
        A: "A structured risk-assessment process (of the kind in IMF/OECD literature) is applied as part of a multi-year strategic planning process to assess and prioritise compliance risks for all core taxes, the four main compliance obligations, key taxpayer segments and at least three major sectors/industries of economic importance.",
        B: "As A but the process is not part of multi-year strategic planning (it is linked to annual business planning) and covers at least one major economic sector.",
        C: "A less structured process assesses and prioritises compliance risks for all core taxes and the four main compliance obligations.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Does the administration have a structured process (per contemporary management literature / IMF + OECD publications) to assess and prioritise compliance risks?",
        "Does that process cover all core taxes, the key taxpayer segments, and specific industries/sectors ranked by economic importance and risk?",
        "Is the process part of multi-year strategic planning, or linked to annual business planning?",
        "Does the administration maintain a compliance risk register describing each risk and the threat it poses (impact on revenue, policy goals, community confidence, reputation)?",
        "Does it estimate the amount of tax unpaid due to noncompliance (revenue leakage) — for unregistered businesses, avoidance, evasion and fraud — using a documented, consistently applied methodology, across all core taxes, and is it published?",
      ],
      evidence_checklist: [
        "Documented risk-management methodology used to identify/assess/prioritise risks",
        "Register of identified compliance risks per taxpayer segment / sub-segment",
        "Documentation showing how risks were assessed + prioritised (e.g. a risk-rating matrix)",
        "A prior-year risk assessment and how it was applied in a subsequent compliance plan",
        "Documented methodology + estimates of tax revenue leakage; any published leakage reports",
      ],
    },
  ],
};

const P2_4: IndicatorDefinition = {
  code: "P2-4",
  name: "Mitigation of risks through a compliance improvement plan",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension; the indicator score is that score.",
  measures:
    "The degree to which the administration mitigates assessed risks to the tax system through a compliance improvement plan.",
  bands: {
    // Field Guide Table 9, p 48
    A: "(i) A documented compliance improvement plan exists with mitigation activities for all high risks identified in the risk-rating process, covering all core taxes, the four main compliance obligations and key taxpayer segments; and (ii) the plan is fully implemented and resourced.",
    B: "As A for all core taxes and the four obligations; at least the large-taxpayer segment is specifically covered; the plan is fully implemented and resourced.",
    C: "A documented annual compliance plan exists with mitigation activities for identified risks but may not cover all core taxes, all four obligations or all key segments; some aspects may not be fully implemented/resourced.",
    D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV — Table 8 (p 43), Table 9 (p 48); Box 2 p 36",
  questions: [
    "Does the administration have a compliance improvement plan to mitigate identified risks to the tax system?",
    "Does the plan include mitigation actions for all core taxes, the key taxpayer segments, the four main compliance obligations, and all risks assessed as 'high'?",
    "Does it also cover less serious risks where ongoing monitoring (rather than active intervention) is appropriate?",
    "Does the plan cover multiple years or a single year only?",
    "To what extent was the most recent completed year's plan resourced and implemented?",
  ],
  evidence_checklist: [
    "The documented multi-year and/or annual compliance improvement plan",
    "Evidence the most recent plan was resourced and implemented",
  ],
};

const P2_5: IndicatorDefinition = {
  code: "P2-5",
  name: "Monitoring and evaluation of compliance risk mitigation activities",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension; the indicator score is that score.",
  measures:
    "The process used to monitor and evaluate the impact of compliance risk mitigation activities.",
  bands: {
    // Field Guide Table 9, pp 48–49
    A: "(i) Formal governance at senior level (e.g. an active risk-management committee) approves mitigation strategies and monitors progress at least monthly; and (ii) evaluations of the effectiveness of all approved strategies in achieving targeted outcomes are documented and reviewed by senior management at least every six months.",
    B: "As A but monitoring is quarterly, and evaluations cover at least 50 percent of approved strategies, reviewed at least six-monthly.",
    C: "Strategies are approved at senior level and results monitored less frequently; evaluations of effectiveness are sometimes documented and reviewed.",
    D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV — Table 8 (p 44), Table 9 (pp 48–49)",
  questions: [
    "What governance arrangements exist (e.g. a risk-management committee), how often does it meet, and what are the arrangements for assessing risks and preparing compliance improvement plans?",
    "Does the administration monitor progress and evaluate the impact of risk-mitigation initiatives against set objectives, with regular reports to senior management?",
    "Has it quantified the compliance impact (revenue collections + taxpayer behaviour) of the main mitigation activities over the past 1–2 years?",
    "Is there evidence of alerting policy makers to weaknesses in the law that expose the tax system to high risk (e.g. aggressive tax planning)?",
    "Is it usual practice to document findings from mitigation activities and feed them into future compliance improvement plans?",
  ],
  evidence_checklist: [
    "Terms of reference + membership of the compliance risk-management committee",
    "Minutes of committee meetings (review of prior plans, approval of current, effectiveness, decisions)",
    "Two consecutive status reports on planned risk-mitigation activities",
    "An evaluation report of a prior-year plan + impact evaluation (revenue + behaviour)",
    "Documented process for feeding findings into future plans; reports to policy makers + resulting law changes",
  ],
};

const P2_6: IndicatorDefinition = {
  code: "P2-6",
  name: "Management of operational risks",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule:
    "M1 — the indicator equals the lowest of its dimension scores (P2-6-1, P2-6-2).",
  measures:
    "How the administration identifies/assesses/mitigates operational risks and approves, monitors, tests and evaluates its business continuity program.",
  bands: {
    A: "Both dimensions A — an annual organisation-wide operational-risk process with BIA (RTO/RPO), comprehensive business-continuity plans, and tested, governed, regularly evaluated continuity arrangements.",
    B: "Lowest dimension is B.",
    C: "Lowest dimension is C.",
    D: "Lowest dimension is D — requirements for C not met, or evidence insufficient.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV — Table 8 (pp 44–45), Table 9 (pp 49–50); Box 3 p 37",
  dimensions: [
    {
      dim_id: "P2-6-1",
      dim_name: "Process used to identify, assess, and mitigate operational risks",
      measures:
        "Whether operational risks (IT failure, cyber breach, data loss) are identified, assessed and prioritised in a register, with a business impact analysis and business-continuity plans, and staff trained.",
      bands: {
        // Field Guide Table 9, p 49
        A: "(i) A structured process is applied annually across the whole organisation to identify, assess and prioritise operational risks in a risk register; (ii) a business impact analysis incorporating detailed RTO and RPO is prepared annually; (iii) comprehensive business-continuity plans are developed for at least three identified risk areas (e.g. IT, natural disasters, human-made events); (iv) all staff are formally trained and tested at least annually on their operational-risk roles.",
        B: "As A but the BIA is prepared every two years, BC plans cover two risk areas, and staff are trained + tested every two years.",
        C: "A less structured annual process; a less detailed BIA (not fully incorporating RTO/RPO) every two years; a BC plan for one risk area; staff trained (no testing) every two years.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Does the administration have a structured process to identify, assess, prioritise, prevent and mitigate operational risks (e.g. IT-system failure, cyber-security breach, loss of taxpayer data), forming part of its planning?",
        "Does it maintain an operational risk register?",
        "Does it conduct a Business Impact Analysis (including where third parties deliver services) to understand impact, the recovery time objective (RTO) and recovery point objective (RPO)?",
        "Has it prepared a business-continuity strategy and documented plans/procedures for restoring operations after an incident, with clearly defined roles?",
        "Is there mandatory organisation-wide operational-risk training of staff, and have suppliers' business-continuity capabilities been evaluated?",
        "Do formal business-continuity governance arrangements exist, with senior-management support and ownership?",
      ],
      evidence_checklist: [
        "Documented operational-risk methodology incl. a vulnerability/cyber risk assessment",
        "Operational risk register",
        "Business Impact Analysis reports (with RTO/RPO)",
        "Documentation showing risks assessed + prioritised, with mitigation plans + reports to senior management",
        "Business-continuity plans (including any from third parties)",
        "Staff training plans covering operational risks",
      ],
    },
    {
      dim_id: "P2-6-2",
      dim_name: "Process to approve, monitor, test and evaluate the business continuity program",
      measures:
        "Whether the business-continuity program is endorsed at senior level, monitored, exercised/tested, and evaluated (including post-incident review).",
      bands: {
        // Field Guide Table 9, p 50
        A: "(i) The Operational Risk Management Committee (or senior leadership team) endorses the business-continuity strategy and monitors implementation six-monthly, taking corrective action; (ii) business-continuity exercises are conducted at least every six months for all staff, with results documented and any systemic weaknesses addressed.",
        B: "As A but on an annual basis.",
        C: "The committee/SLT formally endorses the BC strategy but monitoring is ad hoc; BC exercises are conducted at least annually but not all staff are involved, with results still documented.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Is the business-continuity management program tested, with results and recommendations documented, reviewed and acted on by senior management?",
        "How often is the BC / disaster-recovery plan reviewed and updated?",
        "Does the administration monitor progress and evaluate the impact of operational-risk mitigation initiatives, with regular reports to senior management?",
        "How does it test its capability to respond to disruptions — e.g. disaster-simulation exercises — and are all staff involved?",
        "If an incident has occurred, did the administration undertake a timely post-incident evaluation of the business-continuity / disaster-recovery plan covering all relevant aspects?",
      ],
      evidence_checklist: [
        "Terms of reference of the Operational Risk Management Committee",
        "Two consecutive reports evaluating the business-continuity plans",
        "Documented senior-management responses on implementing the BC program",
        "Post-incident review reports (with recommendations + senior endorsement)",
      ],
    },
  ],
};

const P2_7: IndicatorDefinition = {
  code: "P2-7",
  name: "Management of human capital risks",
  poa: 2,
  poa_name: "Effective Risk Management",
  scoring_method: "M1",
  scoring_rule:
    "M1 — the indicator equals the lowest of its dimension scores (P2-7-1, P2-7-2).",
  measures:
    "Whether the administration has the capacity and structures to manage human capital risks, and evaluates their status and mitigation.",
  bands: {
    A: "Both dimensions A — a comprehensive HR strategy with a documented HCR register and governance, plus an independent annual HCR evaluation that is acted upon and reported.",
    B: "Lowest dimension is B.",
    C: "Lowest dimension is C.",
    D: "Lowest dimension is D — requirements for C not met, or evidence insufficient.",
  },
  field_guide_ref: "Field Guide 2025, Ch IV — Table 8 (p 46), Table 9 (pp 50–51); Box 4 p 39",
  dimensions: [
    {
      dim_id: "P2-7-1",
      dim_name: "Capacity and structures to manage human capital risks",
      measures:
        "Whether an HR strategy, formal HCR processes (capability, capacity, compliance, cost, connection), governance and performance management are in place.",
      bands: {
        // Field Guide Table 9, p 50
        A: "(i) The organisation has a comprehensive, up-to-date HR strategy; (ii) formal processes identify/assess/prioritise/mitigate HCRs, documented in a risk register; (iii) all managers/supervisors are trained to understand HCRs and their impact; (iv) an active senior governance structure reviews HCRs at least annually; (v) all staff have annual performance agreements with reviews at least twice a year.",
        B: "As A(i–iii); the governance review is every two years; performance reviews are conducted annually.",
        C: "Has the HR strategy; HCR processes exist but are less structured and not regular; managers are made aware ad hoc; governance and performance reviews are ad hoc.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Which unit is responsible for HR management (policy, implementation, evaluation), and does the organisation have a comprehensive HR strategy?",
        "Is there an open, transparent performance-management process across the whole organisation?",
        "Does the administration maintain a human-capital-risk register and a formal process for short- and long-term HCRs across the five areas (capability, capacity, compliance, cost, connection)?",
        "Do the strategies specifically address gender equality and balance?",
        "Does the HR team have experience/training in identifying and addressing HCRs, and are managers aware of HCRs and supported in mitigating them?",
      ],
      evidence_checklist: [
        "Organisational + HR-function structure and the HR strategy",
        "Documented HCR methodology and risk register",
        "Documentation showing HCRs assessed/prioritised + mitigation plans/reports",
        "Performance-management policy + signed performance reviews",
        "Records of HCR training and employee-engagement surveys",
      ],
    },
    {
      dim_id: "P2-7-2",
      dim_name: "Evaluation of human capital risk status and mitigation interventions",
      measures:
        "Whether the administration formally evaluates HCR status and the effectiveness of mitigation interventions, and reports it.",
      bands: {
        // Field Guide Table 9, p 51
        A: "(i) A person independent of the HR function conducts a formal evaluation (including a staff survey) of HCR status at least annually; (ii) an annual impact analysis evaluates the effectiveness of mitigating interventions and findings are acted on; (iii) the annual report contains an HCR section including the evaluation results.",
        B: "As A but the HR area itself conducts the annual evaluation; (ii) and (iii) as in A.",
        C: "The HR area conducts a formal evaluation at least every two years; an impact analysis is acted on; the annual-report HCR section appears every two years.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Does the administration evaluate the results of HCR assessments and the impact of HCR mitigation measures — who conducts it and how often?",
        "Does the annual operations report contain details of the HCR evaluation, and is it published?",
      ],
      evidence_checklist: [
        "Two recent HCR reports presented to an Institutional Risk Management Committee / Senior Leadership Team",
        "The tax administration's annual report (with the HCR section)",
      ],
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
  scoring_rule:
    "M1 — the indicator equals the lowest of its dimension scores (P3-8-1, P3-8-2, P3-8-3).",
  measures:
    "Whether taxpayer-facing information is comprehensive in scope, kept current, and easy to access across channels and segments.",
  bands: {
    A: "All dimensions A — information covers all core taxes and obligations, tailored to key segments, kept promptly up to date, and delivered through a wide range of channels and languages.",
    B: "Lowest dimension is B.",
    C: "Lowest dimension is C.",
    D: "Lowest dimension is D — requirements for C not met, or evidence insufficient.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 56–58 + 62–63",
  dimensions: [
    {
      dim_id: "P3-8-1",
      dim_name: "Scope of information",
      measures:
        "Whether information covers all core taxes and the main taxpayer obligations and is tailored to the needs of key taxpayer segments.",
      bands: {
        A: "Information is available for all core taxes and covers all main obligations (how to register, file, pay, and what is taxable), is tailored to the needs of key taxpayer segments (including those with special needs), and a documented strategy guides what is produced and for whom.",
        B: "Information covers all core taxes and main obligations with only minor gaps in segment tailoring.",
        C: "Information covers the main obligations for the core taxes but is general (not tailored to segments) and/or has gaps for some obligations.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Does the administration provide information covering all core taxes and the main taxpayer obligations (how to register, how to file, how to pay, and what is taxable)?",
        "Is the information tailored to the needs of key taxpayer segments (e.g. small businesses, large taxpayers, individuals, and those with special needs such as the visually impaired)?",
        "Is there a documented taxpayer-services / education / communication strategy that guides what information is produced and for whom?",
      ],
      evidence_checklist: [
        "The taxpayer-information catalogue (guides, FAQs, leaflets, web pages) across the core taxes",
        "Examples of segment-tailored products (small business, large taxpayer, individuals)",
        "The taxpayer-services / education / communication strategy",
      ],
    },
    {
      dim_id: "P3-8-2",
      dim_name: "Currency of information",
      measures:
        "Whether information products are reviewed and updated promptly when laws, rates, or procedures change.",
      bands: {
        A: "Documented procedures ensure all information products are reviewed and updated promptly at every legislative or procedural change, and a periodic check confirms no out-of-date material remains in circulation.",
        B: "Information products are updated for legislative/procedural changes, but updates are periodic rather than immediate and minor lags occur.",
        C: "Information products are updated only occasionally; some out-of-date material remains in circulation.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "When tax laws, rates, or procedures change, how and how quickly are the related information products reviewed and updated?",
        "Are there documented procedures (with a clear owner) for keeping information products current, and is there a check that no out-of-date material remains published?",
      ],
      evidence_checklist: [
        "Documented procedure for reviewing/updating information products (with owner)",
        "Version history / change log for key products showing updates after recent law changes",
        "A sample of current published products with their last-updated dates",
      ],
    },
    {
      dim_id: "P3-8-3",
      dim_name: "Accessibility and ease of access",
      measures:
        "Whether information is delivered through a range of channels and languages and is easy for taxpayers to find and understand.",
      bands: {
        A: "Information is delivered through a wide range of channels (website/portal, contact centre, in person, email, social media, mobile) in the main languages used by taxpayers, and is easy to find and understand.",
        B: "Information is delivered through several channels in the main languages; most products are easy to find with only minor gaps.",
        C: "Information is available but through limited channels and/or only one language, and taxpayers must often telephone for clarification.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "Through which channels is taxpayer information made available (website, online portal, contact centre, in person, email, social media, mobile app), and in which languages?",
        "How easy is it for taxpayers to find and understand the information they need (e.g. search, plain language, mobile access)?",
      ],
      evidence_checklist: [
        "List of service/information channels and the languages supported",
        "The taxpayer website/portal (links or screenshots) showing key information products",
        "Any usability or readability review of information products",
      ],
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
    "M2 — the Field Guide applies a 2-dimension conversion table. For the evidence flow each dimension is scored on its own and the indicator is shown as the weaker of the two.",
  measures:
    "How promptly the administration answers taxpayer enquiries — median telephone waiting time and written/electronic response turnaround.",
  bands: {
    A: "Both dimensions A — fast telephone answering (median ≤ 6 minutes) and ≥95% of written/electronic requests answered within the published standard.",
    B: "Lowest dimension is B.",
    C: "Lowest dimension is C.",
    D: "Lowest dimension is D — below the C threshold, not measured, or evidence insufficient.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 58–59 + 63–64",
  dimensions: [
    {
      dim_id: "P3-9-1",
      dim_name: "Telephone enquiry waiting time",
      measures:
        "The median (P50) time a taxpayer waits to reach an agent on the telephone enquiry service.",
      bands: {
        A: "Median telephone waiting time to reach an agent is 6 minutes or less.",
        B: "Median telephone waiting time is more than 6 and up to 8 minutes.",
        C: "Median telephone waiting time is more than 8 and up to 10 minutes.",
        D: "Median waiting time exceeds 10 minutes, OR it is not measured / evidence is insufficient.",
      },
      questions: [
        "What is the median (P50) waiting time for a taxpayer to reach an agent on the telephone enquiry service, over the most recent 12 months?",
        "How is telephone waiting time measured and reported, and what is the call-abandonment rate?",
      ],
      evidence_checklist: [
        "Contact-centre performance report showing median waiting time and abandonment rate for the last 12 months",
        "The methodology or system used to measure telephone waiting times",
      ],
    },
    {
      dim_id: "P3-9-2",
      dim_name: "Written / electronic enquiry response time",
      measures:
        "The share of written or electronic information requests answered within the published service standard.",
      bands: {
        A: "At least 95% of written/electronic information requests receive a substantive response within the published standard (e.g. 14 calendar days).",
        B: "At least 90% receive a response within the standard (e.g. 21 calendar days).",
        C: "At least 80% receive a response within the standard (e.g. 30 calendar days).",
        D: "Below the C threshold, OR response time is not measured / evidence is insufficient.",
      },
      questions: [
        "What is the published service standard for responding to written/electronic information requests, and what percentage are answered within it over the most recent 12 months?",
        "How is written-response turnaround measured and reported?",
      ],
      evidence_checklist: [
        "Correspondence / e-service performance report showing the percentage responded to within the standard",
        "The published service standard for written/electronic responses",
      ],
    },
  ],
};

const P3_10: IndicatorDefinition = {
  code: "P3-10",
  name: "Scope of initiatives to reduce taxpayer compliance costs",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension; the indicator score is that score.",
  measures:
    "Programmes that simplify obligations or reduce the time and cost for taxpayers to comply (pre-filling, simplified regimes/record-keeping, streamlined online services, intermediary engagement).",
  bands: {
    A: "Multiple, actively maintained initiatives simplify obligations and reduce taxpayers' time/cost to comply (e.g. pre-filled returns, simplified regimes/record-keeping for small taxpayers, streamlined online processes, engagement with tax agents/intermediaries), AND the administration measures the resulting reduction in compliance burden.",
    B: "Several such initiatives are in place and maintained, with partial measurement of their impact on compliance costs.",
    C: "Some initiatives exist but are limited in scope and their impact on compliance costs is not measured.",
    D: "Requirements for a C or higher are not met, OR evidence to objectively assess the indicator is insufficient or unavailable.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 59 + 64–65",
  questions: [
    "What initiatives does the administration use to simplify obligations and reduce the time and cost for taxpayers to comply (e.g. pre-filled returns, simplified regimes/record-keeping for small businesses, streamlined online filing/payment, withholding at source)?",
    "How does it engage tax agents and intermediaries to reduce compliance costs?",
    "Does it measure the reduction in taxpayers' compliance burden resulting from these initiatives?",
  ],
  evidence_checklist: [
    "Description of the main compliance-cost-reduction initiatives (with current status)",
    "Evidence of simplified regimes / pre-filling / streamlined online services",
    "Any study or metrics on taxpayer compliance burden or cost",
  ],
};

const P3_11: IndicatorDefinition = {
  code: "P3-11",
  name: "Obtaining taxpayer feedback on services",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M1",
  scoring_rule:
    "M1 — the indicator equals the lowest of its dimension scores (P3-11-1, P3-11-2).",
  measures:
    "Whether the administration routinely obtains taxpayer feedback on its products and services and demonstrably acts on what it hears.",
  bands: {
    A: "Both dimensions A — a range of feedback methods used routinely across key segments, and feedback systematically used to improve products and services.",
    B: "Lowest dimension is B.",
    C: "Lowest dimension is C.",
    D: "Lowest dimension is D — requirements for C not met, or evidence insufficient.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 60 + 65–66",
  dimensions: [
    {
      dim_id: "P3-11-1",
      dim_name: "Use of feedback methods",
      measures:
        "The range of methods used to routinely obtain taxpayer feedback on products and services, and their coverage of key segments.",
      bands: {
        A: "A range of methods is used to routinely obtain taxpayer feedback on products and services (e.g. perception surveys, focus groups, advisory/consultative panels, complaint and contact-centre analytics), covering all key taxpayer segments.",
        B: "More than one method is used routinely, covering most key segments.",
        C: "A single or ad hoc method is used to obtain feedback.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "What methods does the administration use to obtain taxpayer feedback on its products and services (perception surveys, focus groups, advisory/consultative committees, complaint and contact-centre analytics)?",
        "How regularly is feedback obtained, and does it cover the key taxpayer segments?",
      ],
      evidence_checklist: [
        "The taxpayer feedback / consultation strategy or plan",
        "Recent taxpayer satisfaction / perception survey reports",
        "Records of advisory-panel / focus-group / consultation activities",
      ],
    },
    {
      dim_id: "P3-11-2",
      dim_name: "Acting on feedback",
      measures:
        "Whether feedback is analysed and demonstrably used to improve products, services and processes.",
      bands: {
        A: "Feedback is systematically analysed and demonstrably used to improve products, services and processes, with the changes documented and (where relevant) communicated back to taxpayers.",
        B: "Feedback is analysed and some improvements are traceable to it.",
        C: "Feedback is collected but only occasionally acted upon.",
        D: "Requirements for a C or higher are not met, OR evidence to objectively assess the dimension is insufficient or unavailable.",
      },
      questions: [
        "How is taxpayer feedback analysed and used to improve products, services and processes?",
        "Can the administration point to specific improvements made as a result of taxpayer feedback in the past 1–2 years?",
      ],
      evidence_checklist: [
        "Examples of service or process improvements driven by taxpayer feedback",
        "Reports showing analysis of feedback and the resulting action plans",
      ],
    },
  ],
};

const P3_12: IndicatorDefinition = {
  code: "P3-12",
  name: "Initiatives to encourage accurate reporting",
  poa: 3,
  poa_name: "Supporting and Facilitating Compliance",
  scoring_method: "M1",
  scoring_rule: "M1 — single dimension; the indicator score is that score.",
  measures:
    "Programmes that proactively help taxpayers report correctly the first time — cooperative compliance, large-taxpayer engagement, advance rulings/clarifications, and targeted education campaigns.",
  bands: {
    A: "Active, well-documented programmes proactively help taxpayers report correctly the first time — e.g. cooperative-compliance arrangements with large taxpayers, a public/private (advance) ruling or clarification regime, AND targeted education campaigns for higher-risk segments.",
    B: "Some such programmes are in place (e.g. a ruling regime and education campaigns) with partial coverage of key segments.",
    C: "Proactive engagement is limited (e.g. ad hoc rulings or one-off campaigns).",
    D: "Requirements for a C or higher are not met, OR evidence to objectively assess the indicator is insufficient or unavailable.",
  },
  field_guide_ref: "Field Guide 2025, Ch V, pp 61 + 66",
  questions: [
    "Does the administration operate cooperative-compliance or enhanced-relationship arrangements with large taxpayers to support accurate reporting?",
    "Is there a public and/or private (advance) ruling or clarification regime that gives taxpayers certainty on how the law applies?",
    "Does it run targeted education or outreach campaigns to help higher-risk segments report correctly?",
  ],
  evidence_checklist: [
    "Description of cooperative-compliance / large-taxpayer engagement arrangements",
    "The rulings / clarifications regime (guidance issued + volumes)",
    "Examples of targeted taxpayer-education campaigns and their reach",
  ],
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
