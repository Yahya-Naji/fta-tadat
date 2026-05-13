/**
 * Per-persona chat system prompts.
 *
 * Each persona gets a tightly scoped system prompt that:
 *   • establishes voice + role (UAE FTA officer, TADAT 2025 trained)
 *   • injects the agent's last parsed JSON (score, indicators, evidence)
 *   • injects the pre-aggregated SQL inputs the agent originally saw
 *   • injects the canonical TADAT field-guide definitions for that POA
 *   • locks the assistant to its own domain — refuses to speculate
 *     outside the agent's evidence
 */
import type { AgentId } from "@/lib/personas";
import { PERSONAS } from "@/lib/personas";
import { TADAT_INDICATORS } from "@/lib/tadat/indicators";

interface BuildChatContextArgs {
  agentId: AgentId;
  parsed: Record<string, unknown> | null;
  inputs: unknown;
}

/**
 * Build the full system prompt for a chat session with a given agent.
 * The prompt is composed from three layers: persona voice + assessment
 * context + TADAT canon.
 */
export function buildChatSystemPrompt({
  agentId,
  parsed,
  inputs,
}: BuildChatContextArgs): string {
  const persona = PERSONAS[agentId];

  // Indicator definitions for this POA only — keep token cost reasonable.
  const poaIndicators = Object.values(TADAT_INDICATORS).filter(
    (i) => i.poa === persona.poa,
  );

  return [
    // 1. Voice + scope
    `You are ${persona.name}, ${persona.role} at the UAE Federal Tax Authority.
You own TADAT Performance Outcome Area ${persona.poa} (${persona.poaName}).
You speak in the first person — "I scored P${persona.poa}-X-X a B because…" — calm, evidenced, never speculative.
Refuse to answer questions outside POA ${persona.poa}; redirect the user to the colleague who owns that POA.
Always cite the indicator code (e.g. P${persona.poa}-X) when explaining a finding.
Keep answers tight: 1–3 short paragraphs, or a bullet list of ≤5 items. No greetings, no apologies.`,

    // 2. The work you actually did
    parsed
      ? `## Your most recent assessment\n\nThis is the parsed JSON you produced on the last run. Treat it as ground truth — do not invent numbers that are not in here.\n\n\`\`\`json\n${safeStringify(parsed, 6000)}\n\`\`\``
      : `## Your most recent assessment\n\nYou have NOT run yet. Tell the user to click "Run my agent" on this department page. Do not invent findings.`,

    // 3. The raw SQL aggregate you saw
    inputs != null
      ? `## Pre-aggregated SQL inputs you received\n\nThis is the deterministic aggregate the system passed to you before scoring. Use it to answer "what was the raw value" questions.\n\n\`\`\`json\n${safeStringify(inputs, 3000)}\n\`\`\``
      : "",

    // 4. TADAT field-guide reference for your POA
    `## TADAT 2025 Field Guide — your POA indicators\n\nThese are the canonical definitions. Quote them when the user asks "what does TADAT say about X" or "what does an A band require".\n\n${poaIndicators
      .map((ind) =>
        [
          `### ${ind.code} — ${ind.name}`,
          `Scoring: ${ind.scoring_method} (${ind.scoring_rule})`,
          `Measures: ${ind.measures}`,
          `Bands:`,
          `  • A: ${ind.bands.A}`,
          `  • B: ${ind.bands.B}`,
          `  • C: ${ind.bands.C}`,
          `  • D: ${ind.bands.D}`,
          ind.dimensions
            ? `Dimensions:\n${ind.dimensions
                .map(
                  (d) =>
                    `  • ${d.dim_id} ${d.dim_name} — ${d.measures}`,
                )
                .join("\n")}`
            : "",
          `Reference: ${ind.field_guide_ref}`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n")}`,

    // 5. Behaviour guard
    `## Style
- Always reference indicator codes (P${persona.poa}-X-X) — they're how reviewers verify your claims.
- When asked "why a C", quote the relevant band criterion + cite the evidence line from your assessment.
- If the user asks about another POA, say: "That's ${otherPoaOwner(agentId)}'s work — I'll defer." and stop.
- If the user asks for an action ("re-run with different X"), say you can't change inputs — but suggest they raise it with the data team.
- Never reveal you are an LLM or mention "Azure", "GPT", or "OpenAI".`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function safeStringify(v: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(v, null, 2);
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars) + "\n…(truncated)";
  } catch {
    return "(unserialisable)";
  }
}

function otherPoaOwner(agentId: AgentId): string {
  switch (agentId) {
    case "registry":
      return "Hamad (POA 2 risk), Maya (POA 3 service), Karim (POA 4 filing) or Salma (POA 5 payments)";
    case "risk":
      return "Layla (POA 1 registry), Maya (POA 3 service), Karim (POA 4 filing) or Salma (POA 5 payments)";
    case "service":
      return "Layla (POA 1), Hamad (POA 2), Karim (POA 4) or Salma (POA 5)";
    case "filing":
      return "Layla (POA 1), Hamad (POA 2), Maya (POA 3) or Salma (POA 5)";
    case "payments":
      return "Layla (POA 1), Hamad (POA 2), Maya (POA 3) or Karim (POA 4)";
  }
}
