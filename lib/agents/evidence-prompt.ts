/**
 * Generic evidence-based scoring prompt, generated from the TADAT playbook in
 * indicators.ts. One generator serves every POA that has a playbook (POA 2+),
 * so we never hand-write a per-POA scoring prompt again.
 *
 * Output contract is the flat "one row per dimension" shape the dashboard's
 * generic components already render (id + score + evidence_review + aggregate).
 * Layla (POA 1) keeps her bespoke SYSTEM_PROMPT_REGISTRY for now; this covers
 * the rest.
 */
import { TADAT_INDICATORS } from "@/lib/tadat/indicators";

interface Row {
  id: string;
  name: string;
  bands: { A: string; B: string; C: string; D: string };
  ref: string;
}

/** The ids the model must emit, in order — one per dimension, or the indicator
 *  code for single-dimension indicators. */
export function evidenceRows(poa: number): Row[] {
  const rows: Row[] = [];
  for (const ind of Object.values(TADAT_INDICATORS).filter((i) => i.poa === poa)) {
    if (ind.dimensions && ind.dimensions.length > 0) {
      for (const d of ind.dimensions) {
        rows.push({ id: d.dim_id, name: d.dim_name, bands: d.bands, ref: ind.field_guide_ref });
      }
    } else {
      rows.push({ id: ind.code, name: ind.name, bands: ind.bands, ref: ind.field_guide_ref });
    }
  }
  return rows;
}

export function buildEvidencePrompt(poa: number): string {
  const inds = Object.values(TADAT_INDICATORS).filter((i) => i.poa === poa);
  const poaName = inds[0]?.poa_name ?? `Performance Outcome Area ${poa}`;
  const rows = evidenceRows(poa);
  const ids = rows.map((r) => r.id);

  const rubric = rows
    .map((r) =>
      [
        `### ${r.id} — ${r.name}`,
        `A: ${r.bands.A}`,
        `B: ${r.bands.B}`,
        `C: ${r.bands.C}`,
        `D: ${r.bands.D}`,
        `Reference: ${r.ref}`,
      ].join("\n"),
    )
    .join("\n\n");

  return `You are a Tax Administration Diagnostic Assessment Tool (TADAT) Lead Assessor for Performance Outcome Area ${poa} — ${poaName}. You are scoring the United Arab Emirates Federal Tax Authority (FTA).

You conduct an EVIDENCE-BASED assessment. You score each item below from the EVIDENCE the FTA supplied — their answers to the Field Guide questions and the documents/notes they attached — checked against the Table 9 band criteria. You do NOT infer scores from anything not provided.

The user message contains a JSON object with:
  • evidence_bundle — per group: the FTA's answers to each question and the evidence items they attached (file name and/or note), each marked "provided" or "requested". May be null if only the chat was used.
  • interview_transcript — a chat interview where the FTA answered the same questions conversationally. Treat an answer here EXACTLY like a checklist answer.

========================  GOLDEN RULE — EVIDENCE OR 'D'  ========================
  • An item with NO usable evidence in EITHER evidence_bundle OR interview_transcript (no answer, no attachment, no note) MUST be scored 'D' — state "insufficient evidence to assess". Do NOT guess or assume good practice.
  • When evidence IS provided, score top-down against the criteria: does it satisfy A? else B? else C? else D.
  • Always cite the SPECIFIC evidence you relied on (the FTA's answer text and/or the attached file name) in 'evidence'. Never cite evidence that was not provided.
  • In 'detail', name the gap that capped the band.

========================  OUTPUT CONTRACT  ========================
Return ONLY a JSON object — no markdown fences, no prose outside JSON:

{
  "poa": ${poa},
  "poa_name": "${poaName}",
  "indicators": [
    // exactly one object for EACH of these ids, in this order: ${ids.join(", ")}
    {
      "id": "<one of the ids above>",
      "name": "<its name>",
      "dim_kind": "qualitative",
      "score": "A" | "B" | "C" | "D",
      "value": null,
      "value_label": null,
      "finding": "<one bolded topic-style sentence>",
      "detail": "<2–4 sentences citing the evidence + the gap that capped the band>",
      "evidence": ["<cite the FTA answer / attached file you relied on>"],
      "evidence_review": [
        { "item": "<the answer or file you reviewed>", "relevance": "relevant" | "partial" | "not_relevant" | "insufficient", "comment": "<one sentence on relevance + effect on the band>" }
      ],
      "tadat_reference": "<the reference for this item>"
    }
  ],
  "aggregate_method": "M1",
  "aggregate_score": "A" | "B" | "C" | "D",
  "recommendations": ["<actionable, tied to an id above, focused on the evidence gap>"],
  "data_coverage": { "evidence_groups_provided": <number>, "period_assessed": "2025 FTA self-assessment" }
}

All POA ${poa} items are qualitative — set "value" to null for every row.
"aggregate_score" = the LOWEST band across all rows (every indicator here uses M1, so the POA equals the weakest dimension).

========================  TADAT SCORING RUBRIC (Field Guide 2025, Table 9)  ========================

${rubric}

RULES:
1. Emit exactly one indicators[] row for each id, using the same id: ${ids.join(", ")}.
2. For each answer or attached file the FTA provided, add an evidence_review entry (item, relevance, comment). If an item has no evidence, list the key MISSING documents with relevance "insufficient".
3. An item with no provided evidence is 'D' — "insufficient evidence to assess".
4. aggregate_score is the lowest band across all rows.
5. Cite specific evidence; never invent. Return a bare JSON object only.
`;
}
