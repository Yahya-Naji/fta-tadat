/**
 * Q Task agent personas — each agent gets a name, role, and visual identity
 * so the dashboard feels like a workspace of colleagues rather than a button rack.
 *
 * Order matches the TADAT lifecycle: Layla (POA 1) → Hamad (POA 2) → Maya
 * (POA 3) → Karim (POA 4) → Salma (POA 5).
 */

export type AgentId =
  | "registry"
  | "risk"
  | "service"
  | "filing"
  | "payments";

export interface Persona {
  id: AgentId;
  name: string;            // Persona's first name
  role: string;            // Job title in the FTA org chart
  poa: number;             // TADAT POA they own
  poaName: string;         // Pretty POA label
  bio: string;             // Two sentence bio for cards / hover
  caseLabel: string;       // What the dashboard calls the open case
  caseDescription: string; // The "what they'll do" sentence
  /** Initials shown in the avatar circle */
  initials: string;
  /** Tailwind gradient classes for the avatar background */
  avatarGradient: string;
  /** Tailwind text class matching the avatar (used for accents) */
  accentText: string;
  /** Tailwind border class for borders */
  accentBorder: string;
  /** Lucide icon name (resolved by component) */
  icon: "Database" | "ShieldAlert" | "Sparkles" | "FileCheck2" | "Wallet";
}

export const PERSONAS: Record<AgentId, Persona> = {
  registry: {
    id: "registry",
    name: "Layla",
    role: "Registry Health Auditor",
    poa: 1,
    poaName: "Integrity of the Registered Taxpayer Base",
    bio: "Layla scans every TRN in the registry to flag duplicates, missing contacts, and dormant taxpayers wrongly marked Active. She knows the registry is the foundation — if it's dirty, every downstream check is compromised.",
    caseLabel: "Registry Health Audit",
    caseDescription:
      "Audit all 1,024 active TRNs for duplicates, missing contact info, and dormant-flag mismatches.",
    initials: "L",
    avatarGradient: "from-indigo-500 via-violet-500 to-purple-600",
    accentText: "text-indigo-300",
    accentBorder: "border-indigo-500/40",
    icon: "Database",
  },
  risk: {
    id: "risk",
    name: "Hamad",
    role: "Compliance Risk Officer",
    poa: 2,
    poaName: "Effective Risk Management",
    bio: "Hamad consolidates compliance, operational, and human-capital risks into a single ranked register, scoring each by AED at risk and ownership status. He turns the chaos of risk into a worklist FTA leadership can action this quarter.",
    caseLabel: "Risk Register Review",
    caseDescription:
      "Rank compliance + operational + HCR risks by AED at risk; flag owners-unassigned items.",
    initials: "H",
    avatarGradient: "from-rose-500 via-orange-500 to-amber-500",
    accentText: "text-rose-300",
    accentBorder: "border-rose-500/40",
    icon: "ShieldAlert",
  },
  service: {
    id: "service",
    name: "Maya",
    role: "Service & Facilitation Lead",
    poa: 3,
    poaName: "Supporting and Facilitating Compliance",
    bio: "Maya measures every taxpayer touch — telephone wait, info-product currency, intermediary engagement, complaint volumes. She tells the FTA which channel is broken, which info product is stale, and where compliance friction is highest.",
    caseLabel: "Service Friction Audit",
    caseDescription:
      "Score service channels, info products, complaint resolution, and intermediary engagement.",
    initials: "M",
    avatarGradient: "from-fuchsia-500 via-pink-500 to-rose-500",
    accentText: "text-fuchsia-300",
    accentBorder: "border-fuchsia-500/40",
    icon: "Sparkles",
  },
  filing: {
    id: "filing",
    name: "Karim",
    role: "Filing Compliance Officer",
    poa: 4,
    poaName: "Timely Filing of Tax Declarations",
    bio: "Karim reads every VAT, Excise, and Corporate Tax declaration filed in the period, computes on-time rates with large-taxpayer breakouts, and ranks the non-filer worklist by AED impact so enforcement chases the highest-value cases first.",
    caseLabel: "Non-Filer Triage",
    caseDescription:
      "Score on-time filing per core tax, identify the 300 non-filer cases, and rank by revenue impact.",
    initials: "K",
    avatarGradient: "from-cyan-500 via-blue-500 to-indigo-600",
    accentText: "text-cyan-300",
    accentBorder: "border-cyan-500/40",
    icon: "FileCheck2",
  },
  payments: {
    id: "payments",
    name: "Salma",
    role: "Arrears Risk Strategist",
    poa: 5,
    poaName: "Timely Payment of Taxes",
    bio: "Salma stratifies AED 195M of outstanding arrears by collectibility × age × value. She tells the FTA which debtors to pursue, which to put on payment plans, and which to stop wasting officer time on.",
    caseLabel: "Arrears Risk Stratification",
    caseDescription:
      "Stratify AED 195M outstanding into pursue / payment-plan / write-off buckets. Score 3-year arrears trends.",
    initials: "S",
    avatarGradient: "from-emerald-500 via-teal-500 to-cyan-600",
    accentText: "text-emerald-300",
    accentBorder: "border-emerald-500/40",
    icon: "Wallet",
  },
};

export const PERSONA_LIST: Persona[] = [
  PERSONAS.registry,
  PERSONAS.risk,
  PERSONAS.service,
  PERSONAS.filing,
  PERSONAS.payments,
];
