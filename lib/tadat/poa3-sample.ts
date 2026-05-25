/**
 * POA 3 demo answers + evidence, keyed by evidence-request group_id and aligned
 * to buildEvidenceRequests(3). Powers the "Load sample answers" button on the
 * Supporting & Facilitating Compliance page. Illustrative — tuned to land most
 * dimensions at A/B, with proactive accurate-reporting engagement (P3-12) at C,
 * so the lowest-wins POA aggregate shows as C (a believable gap for a young
 * authority where Corporate Tax only began in 2023).
 */
import type { SampleGroup } from "@/lib/tadat/poa1-sample";

export const POA3_SAMPLE: Record<string, SampleGroup> = {
  background: {
    answers: [
      "The Taxpayer Services & Communications department owns taxpayer information, education and contact-centre services, guided by a documented Taxpayer Services & Communication Strategy.",
      "Information and services are delivered through the FTA website, the EmaraTax online portal, a contact centre (phone + email), in-person service centres, social media, and a mobile app — in Arabic and English.",
    ],
    evidence: [
      { file_name: "taxpayer-services-strategy.md" },
      { note: "Org chart showing the Taxpayer Services & Communications units" },
      { note: "Service-channel list with supported languages (Arabic, English)" },
    ],
  },
  "P3-8-1": {
    answers: [
      "Yes — guides, FAQs and web pages cover all core taxes (VAT, Excise, Corporate Tax) and the main obligations: how to register, how to file, how to pay, and what is taxable.",
      "Information is tailored to key segments — small businesses, large taxpayers and individuals — and accessibility features support taxpayers with special needs.",
      "A documented Taxpayer Services & Communication Strategy guides what information is produced and for which segment.",
    ],
    evidence: [
      { file_name: "taxpayer-information-catalogue.md" },
      { note: "Segment-tailored products: SME starter guide, large-taxpayer pack" },
      { note: "Taxpayer Services & Communication Strategy (in background pack)" },
    ],
  },
  "P3-8-2": {
    answers: [
      "When laws, rates or procedures change, the owning policy team flags the affected products and Taxpayer Services updates them; updates follow each change but are applied periodically (in batches) rather than instantly.",
      "A documented update procedure with a named owner exists; a periodic review checks for out-of-date material, though minor lags of a few weeks can occur after a change.",
    ],
    evidence: [
      { file_name: "information-update-procedure.md" },
      { note: "Change log for VAT/CT guides after the latest law amendments" },
      { note: "Sample of current published products showing last-updated dates" },
    ],
  },
  "P3-8-3": {
    answers: [
      "Information is delivered through a wide range of channels — website, EmaraTax portal, contact centre, in-person centres, email, social media and a mobile app — in both Arabic and English.",
      "Products are written in plain language, the website has search, and content is mobile-optimised, so taxpayers can generally find what they need without telephoning.",
    ],
    evidence: [
      { file_name: "service-channels-and-languages.md" },
      { note: "FTA website + EmaraTax portal links to key information products" },
      { note: "Readability review of the top 20 information products" },
    ],
  },
  "P3-9-1": {
    answers: [
      "Over the last 12 months the median (P50) waiting time to reach a contact-centre agent was about 7 minutes.",
      "Waiting time is measured by the contact-centre platform and reported monthly; the call-abandonment rate is around 9%.",
    ],
    evidence: [
      { file_name: "contact-centre-performance-report.md" },
      { note: "Contact-centre platform methodology for measuring wait time" },
    ],
  },
  "P3-9-2": {
    answers: [
      "The published service standard for written/electronic information requests is 21 calendar days, and about 92% are answered within it over the last 12 months.",
      "Turnaround is tracked in the correspondence/case system and reported monthly.",
    ],
    evidence: [
      { file_name: "correspondence-performance-report.md" },
      { note: "Published service standard for written responses (21 days)" },
    ],
  },
  "P3-10": {
    answers: [
      "Several initiatives reduce compliance cost: pre-filled fields and validations in EmaraTax, simplified record-keeping guidance for small businesses, fully online registration/filing/payment, and a tax-agent framework.",
      "Registered tax agents and intermediaries are engaged through briefings and a dedicated channel to streamline bulk filings.",
      "Impact on compliance burden is measured only partially — e.g. online-filing uptake and processing time — not yet a full compliance-cost study.",
    ],
    evidence: [
      { file_name: "compliance-cost-reduction-initiatives.md" },
      { note: "EmaraTax pre-fill / streamlined online-service screenshots" },
      { note: "Online-filing uptake + processing-time metrics" },
    ],
  },
  "P3-11-1": {
    answers: [
      "A range of methods is used routinely: annual taxpayer satisfaction surveys, focus groups, a tax-agent advisory panel, and analytics from complaints and contact-centre contacts.",
      "Feedback is obtained at least annually and covers the key segments (individuals, SMEs, large taxpayers, tax agents).",
    ],
    evidence: [
      { file_name: "taxpayer-feedback-strategy-and-surveys.md" },
      { note: "Latest taxpayer satisfaction / perception survey report" },
      { note: "Records of advisory-panel and focus-group sessions" },
    ],
  },
  "P3-11-2": {
    answers: [
      "Feedback is analysed and fed into service-improvement plans; some changes — e.g. simplified portal screens and clearer VAT guidance — are traceable to taxpayer feedback.",
      "Over the past 1–2 years specific improvements were made in response to feedback, though not every theme is yet closed-looped back to taxpayers.",
    ],
    evidence: [
      { file_name: "service-improvements-from-feedback.md" },
      { note: "Feedback analysis report + resulting action plan" },
    ],
  },
  "P3-12": {
    answers: [
      "Cooperative-compliance / enhanced-relationship arrangements with large taxpayers are being piloted but are not yet an established programme.",
      "A private clarifications regime is in place and actively used, giving taxpayers certainty on how the law applies; a public-ruling programme is still developing.",
      "Taxpayer education has so far been delivered through one-off awareness campaigns (e.g. at Corporate Tax launch) rather than a sustained, targeted programme for higher-risk segments.",
    ],
    evidence: [
      { file_name: "accurate-reporting-initiatives.md" },
      { note: "Private clarifications regime guidance + volumes issued" },
      { note: "Corporate Tax launch awareness-campaign materials" },
    ],
  },
};
