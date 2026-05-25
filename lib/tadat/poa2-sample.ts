/**
 * POA 2 demo answers + evidence, keyed by evidence-request group_id and aligned
 * to buildEvidenceRequests(2). Powers the "Load sample answers" button on
 * Hamad's page. Illustrative — tuned to land most dimensions at B, with the
 * HCR-evaluation dimension at C (so the lowest-wins POA aggregate shows as C).
 */
import type { SampleGroup } from "@/lib/tadat/poa1-sample";

export const POA2_SAMPLE: Record<string, SampleGroup> = {
  background: {
    answers: [
      "The Strategy & Risk function sets risk-management policy under the FTA Enterprise Risk Management Policy; the IT/Data department owns operational/cyber risk and HR owns human-capital risk.",
      "Yes — a Compliance Risk Management Committee and an Operational Risk / Business Continuity Committee of senior managers meet regularly; an SLT reviews enterprise risk.",
    ],
    evidence: [
      { file_name: "risk-committee-charters.md" },
      { note: "FTA Enterprise Risk Management Policy + org chart on file" },
    ],
  },
  "P2-3-1": {
    answers: [
      "Yes — the FTA builds compliance-risk knowledge across VAT, Corporate Tax and Excise, by segment and obligation, drawing on internal and external data.",
      "Environmental scans are run as part of strategic planning, and declarations + financial statements are analysed.",
      "Audit results are analysed, including a small random-audit component to test compliance across samples.",
      "There is research into hidden economic activity and studies of topical issues (transfer pricing/profit shifting, high-wealth individuals, crypto).",
      "Environmental factors influencing taxpayer behaviour are considered in segmentation.",
      "Third-party data (banks, customs, licensing) is used; analytics are mostly descriptive/basic rather than advanced predictive/ML at this stage.",
    ],
    evidence: [
      { file_name: "compliance-risk-research-report.md" },
      { note: "Environmental-scan summary in the strategic plan" },
      { note: "Declaration + financial-statement analysis on file" },
      { note: "Transfer-pricing / profit-shifting study (in research report)" },
      { note: "High-wealth/high-income tax-planning study (in research report)" },
      { note: "Hidden-economy research note" },
      { note: "Behavioural-factors note" },
      { note: "Third-party data + exchange-of-information arrangements" },
    ],
  },
  "P2-3-2": {
    answers: [
      "Yes — a structured risk-assessment process consistent with IMF/OECD guidance assesses and prioritises compliance risks.",
      "It covers all core taxes, the key taxpayer segments and the largest economic sector; broader sector ranking is being expanded.",
      "It is linked to the annual business-planning cycle rather than a full multi-year strategic process.",
      "Yes — a compliance risk register describes each risk and its threat to revenue, policy goals, confidence and reputation.",
      "Revenue-leakage estimates are made for some areas (e.g. VAT) but not yet across all core taxes, and are not published.",
    ],
    evidence: [
      { file_name: "compliance-risk-register.md" },
      { note: "Risk-rating matrix prioritisation (in register)" },
      { note: "Documented risk-assessment methodology" },
      { note: "Prior-year assessment applied to the current plan" },
      { note: "Partial VAT revenue-leakage estimate (internal)" },
    ],
  },
  "P2-4": {
    answers: [
      "Yes — a compliance improvement plan mitigates the identified risks to the tax system.",
      "It covers all core taxes, the four obligations and the high risks; the large-taxpayer segment is specifically covered, with other segments partly covered.",
      "Yes — lesser risks are kept under monitoring rather than active intervention.",
      "It is an annual plan, aligned to the business-planning cycle.",
      "The current plan is resourced and largely implemented, with most actions on track.",
    ],
    evidence: [
      { file_name: "compliance-improvement-plan-2025.md" },
      { note: "Implementation status report for the current plan" },
    ],
  },
  "P2-5": {
    answers: [
      "The Compliance Risk Management Committee oversees mitigation; it meets and reviews progress quarterly.",
      "Progress and impact are monitored against objectives, with reports to senior management.",
      "The compliance impact (revenue + behaviour) of the main activities over the past 1–2 years has been assessed.",
      "Yes — policy makers have been alerted to legal weaknesses (e.g. aggressive tax-planning gaps).",
      "Findings are documented and fed into the next compliance improvement plan.",
    ],
    evidence: [
      { file_name: "risk-committee-minutes-and-evaluation.md" },
      { note: "Two consecutive status reports on mitigation activities" },
      { note: "Prior-year plan evaluation report" },
      { note: "Reports to policy makers on legal weaknesses" },
      { note: "Documented feedback-into-planning process" },
    ],
  },
  "P2-6-1": {
    answers: [
      "Yes — a structured process identifies, assesses, prioritises and mitigates operational risks (IT failure, cyber breach, data loss) as part of planning.",
      "An operational risk register is maintained.",
      "A Business Impact Analysis with RTO/RPO is conducted; it is refreshed about every two years.",
      "A business-continuity strategy and documented recovery procedures with defined roles are in place.",
      "Operational-risk training is provided to staff, and key suppliers' continuity capabilities are reviewed.",
      "Formal BC governance exists with senior-management ownership.",
    ],
    evidence: [
      { file_name: "operational-risk-register-and-bia.md" },
      { note: "Vulnerability / cyber risk assessment" },
      { note: "Business Impact Analysis (RTO/RPO)" },
      { note: "Mitigation plans + reports to senior management" },
      { note: "Business-continuity plans (incl. third parties)" },
      { note: "Operational-risk staff training plan" },
    ],
  },
  "P2-6-2": {
    answers: [
      "The BC program is tested and results/recommendations are documented and acted on by senior management.",
      "The BC / disaster-recovery plan is reviewed annually.",
      "Progress is monitored and reported to senior management.",
      "Capability is tested via disaster-simulation exercises conducted annually (not all staff each time).",
      "Post-incident reviews are conducted when incidents occur.",
    ],
    evidence: [
      { file_name: "business-continuity-program-review.md" },
      { note: "Operational Risk Management Committee terms of reference" },
      { note: "Two consecutive BC-plan evaluation reports" },
      { note: "Post-incident review report" },
    ],
  },
  "P2-7-1": {
    answers: [
      "HR (with the Strategy & Risk function) owns HR management; there is a comprehensive, current HR strategy.",
      "An open performance-management process operates across the organisation.",
      "A human-capital-risk register and a formal process cover the five areas (capability, capacity, compliance, cost, connection).",
      "The strategies address gender equality and balance.",
      "The HR team is trained in HCRs and managers are made aware and supported.",
    ],
    evidence: [
      { file_name: "hr-strategy-and-hcr-register.md" },
      { note: "HCR methodology + risk register" },
      { note: "Performance-management policy + signed reviews" },
      { note: "HCR training records" },
      { note: "Employee-engagement survey" },
    ],
  },
  "P2-7-2": {
    answers: [
      "HCR status and mitigation impact are evaluated by the HR area roughly every two years (not yet annually or by an independent party).",
      "The annual report covers HCR periodically rather than every year.",
    ],
    evidence: [
      { file_name: "hcr-evaluation-report.md" },
      { note: "HCR section of the annual report (latest available)" },
    ],
  },
};
