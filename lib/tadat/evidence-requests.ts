/**
 * Turns the TADAT playbook (indicators.ts) into a flat, render-ready list of
 * "evidence requests" — what Layla (and later each persona) asks the FTA for,
 * grouped exactly as the Field Guide structures a POA assessment:
 *
 *   1. Background questions (asked once, before any dimension)        → POA_BACKGROUND
 *   2. One group per dimension (or per single-dimension indicator)    → questions + evidence
 *
 * This is the single thing the intake UI reads, and the same structure the
 * scoring step (Step 3) will fill with answers + uploaded evidence.
 */
import {
  TADAT_INDICATORS,
  POA_BACKGROUND,
} from "./indicators";

export interface EvidenceRequestGroup {
  /** "background" | a dim_id ("P1-1-1") | a single-dimension indicator code ("P1-2") */
  group_id: string;
  group_label: string;
  scope: "background" | "dimension" | "indicator";
  /** Parent indicator code (for dimensions) — lets the scorer roll up M1/M2. */
  indicator_code?: string;
  questions: string[];
  evidence_checklist: string[];
  tadat_reference?: string;
}

/** Build the ordered request groups for a POA. Groups with neither questions
 *  nor evidence are skipped (e.g. POAs whose playbook isn't authored yet). */
export function buildEvidenceRequests(poa: number): EvidenceRequestGroup[] {
  const groups: EvidenceRequestGroup[] = [];

  const bg = POA_BACKGROUND[poa];
  if (bg && (bg.questions.length > 0 || bg.evidence_checklist.length > 0)) {
    groups.push({
      group_id: "background",
      group_label: "Background",
      scope: "background",
      questions: bg.questions,
      evidence_checklist: bg.evidence_checklist,
    });
  }

  const indicators = Object.values(TADAT_INDICATORS).filter((i) => i.poa === poa);
  for (const ind of indicators) {
    if (ind.dimensions && ind.dimensions.length > 0) {
      for (const d of ind.dimensions) {
        const q = d.questions ?? [];
        const e = d.evidence_checklist ?? [];
        if (q.length === 0 && e.length === 0) continue;
        groups.push({
          group_id: d.dim_id,
          group_label: `${d.dim_id} · ${d.dim_name}`,
          scope: "dimension",
          indicator_code: ind.code,
          questions: q,
          evidence_checklist: e,
          tadat_reference: ind.field_guide_ref,
        });
      }
    } else {
      const q = ind.questions ?? [];
      const e = ind.evidence_checklist ?? [];
      if (q.length === 0 && e.length === 0) continue;
      groups.push({
        group_id: ind.code,
        group_label: `${ind.code} · ${ind.name}`,
        scope: "indicator",
        indicator_code: ind.code,
        questions: q,
        evidence_checklist: e,
        tadat_reference: ind.field_guide_ref,
      });
    }
  }

  return groups;
}

/** True when a POA has an authored playbook (so the UI knows to show intake). */
export function hasPlaybook(poa: number): boolean {
  return buildEvidenceRequests(poa).length > 0;
}

/** Totals for the intake progress bar. */
export function countRequests(groups: EvidenceRequestGroup[]): {
  questions: number;
  evidence: number;
} {
  return groups.reduce(
    (acc, g) => ({
      questions: acc.questions + g.questions.length,
      evidence: acc.evidence + g.evidence_checklist.length,
    }),
    { questions: 0, evidence: 0 },
  );
}
