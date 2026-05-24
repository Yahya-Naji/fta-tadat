/**
 * POA 1 demo answers + evidence, keyed by evidence-request group_id and aligned
 * to the question / evidence order from buildEvidenceRequests(1).
 *
 * Powers the "Load sample answers" button on Layla's page so a demo can be run
 * without typing. Mirrors demo/poa1/ANSWERS.txt + the demo evidence files.
 * Tuned to land P1-1-1 = A, P1-1-2 = B, P1-2 = B → POA 1 = B.
 */

export interface SampleEvidence {
  file_name?: string;
  note?: string;
}
export interface SampleGroup {
  answers: string[]; // aligned to that group's questions
  evidence: SampleEvidence[]; // aligned to that group's evidence_checklist
}

export const POA1_SAMPLE: Record<string, SampleGroup> = {
  background: {
    answers: [
      "Registration is mandatory above the VAT threshold (AED 375,000 taxable supplies), for all taxable persons for Corporate Tax, for importers/producers of excise goods, and for employers. Voluntary VAT registration is allowed above AED 187,500. Persons wholly below thresholds are not required to register; government entities follow specific rules.",
      "Business licensing sits with the emirate economic departments (DET, ADDED) and free zones; identity is anchored on the Emirates ID (ICP). The FTA issues the TRN. Licensing and Emirates ID data are shared with the FTA and validated at registration.",
      "The Registration & Taxpayer Services function owns the process and the EmaraTax register, supported by the IT/Data department for system integrity.",
    ],
    evidence: [
      { file_name: "core-tax-registration-law-extract.md" },
      { note: "FTA EmaraTax registration guide (link on file)" },
      { note: "DET/ADDED + ICP registration references (links on file)" },
      { file_name: "fta-org-chart.md" },
    ],
  },
  "P1-1-1": {
    answers: [
      "Yes — EmaraTax holds full name, address, contact details (phone/email of the taxpayer and any tax agent), date of birth, gender, and the filing & payment obligations for each core tax, keyed to the Emirates ID.",
      "Yes — full legal name, business and postal address, phone/email/website, TRNs of related/associated parties and group members, beneficial owners and persons with significant control, date of incorporation/licence, ISIC industry classification, taxpayer segment, and filing & payment obligations per core tax.",
      "Fully computerised on EmaraTax — a single, centralised national platform. No manual or decentralised register.",
      "One unique high-integrity TRN used across VAT, Corporate Tax and Excise, with a self-validating check digit; it is the single key across all core taxes.",
      "Yes — EmaraTax integrates with filing and payment, gives a whole-of-taxpayer view across all core taxes, supports deactivation of dormant accounts and deregistration with restorable archiving, generates registration management information, keeps a full audit trail of access and changes, and offers secure online self-service with multi-factor authentication.",
    ],
    evidence: [
      { note: "EmaraTax taxpayer-record screenshots (individual + business) on file" },
      { file_name: "emaratax-registration-form.md" },
      { file_name: "emaratax-it-architecture.md" },
      { file_name: "trn-numbering-spec.md" },
      { note: "Officer whole-of-taxpayer view demonstrated in EmaraTax" },
      { note: "Registrations-by-emirate/segment management report on file" },
      { note: "EmaraTax self-service portal demonstrated (MFA enabled)" },
      { file_name: "movements-in-register.csv" },
    ],
  },
  "P1-1-2": {
    answers: [
      "Yes — documented procedures run on a regular schedule to flag dormant accounts and remove duplicate, inactive and invalid records.",
      "Identity is verified against Emirates ID/ICP at registration for all applicants; higher-risk profiles are document-checked before the TRN is activated, while a small share of low-risk cases are verified shortly after registration.",
      "Information is cross-checked against the licensing authorities and the Emirates ID register, and selectively against other sources. This is partly automated but not yet large-scale across every external database; third-party data is treated as reliable given the official sources.",
      "Accounts with no filing across consecutive periods are reviewed and re-classified (dormant/deregistered) where the taxpayer is found inactive.",
      "An internal audit of registry accuracy was completed in the last year and expressed a high level of confidence, with a few minor data-quality items being addressed.",
    ],
    evidence: [
      { file_name: "registry-cleansing-sop.md" },
      { file_name: "identity-verification-sop.md" },
      { note: "Cross-validation with ICP/licensing (covered in the cleansing SOP)" },
      { file_name: "records-removed-2023-2024.csv" },
      { file_name: "internal-audit-registry-accuracy-2024.md" },
    ],
  },
  "P1-2": {
    answers: [
      "Yes — the FTA uses customs import data, emirate licensing records and economic-department data to identify businesses trading above the threshold that have not registered, including digital-service providers and online sellers.",
      "Not currently used in a systematic way.",
      "Yes — when obligations expand (e.g., Corporate Tax roll-out), the register is reviewed to ensure newly-liable taxpayers register for all applicable taxes.",
      "Field visits to commercial districts occur but are not yet a formalised, intelligence-led programme.",
      "Some analysis of e-commerce platforms is done to spot unregistered sellers.",
      "Yes — detection initiatives over the past year are documented, with the number of taxpayers added to the register reported to management.",
    ],
    evidence: [
      { file_name: "unregistered-detection-plan.md" },
      { note: "Customs / licensing / e-commerce / labour sources (listed in the detection plan)" },
      { file_name: "new-registrants-from-detection-2024.csv" },
    ],
  },
};
