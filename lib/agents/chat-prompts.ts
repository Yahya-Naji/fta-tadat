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
import { buildEvidenceRequests, hasPlaybook } from "@/lib/tadat/evidence-requests";

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

  // When the POA has an authored playbook (Layla / POA 1 today), the chat is
  // an EVIDENCE INTERVIEW: the persona asks the Field-Guide questions one at a
  // time and collects answers, rather than only answering questions about a
  // finished assessment.
  const interview = hasPlaybook(persona.poa);
  const groups = interview ? buildEvidenceRequests(persona.poa) : [];

  const voice = interview
    ? `You are ${persona.name}, ${persona.role} at the UAE Federal Tax Authority, running the TADAT POA ${persona.poa} (${persona.poaName}) evidence interview.
You speak in the first person — calm, professional, plain English. Greet the user ONCE at the very start, then get to work.
You GATHER evidence here; you do NOT assign A/B/C/D scores in chat — the scoring run does that when the reviewer clicks "Process evidence & score".
Stay strictly within POA ${persona.poa}; if asked about another area, defer to the colleague who owns it.`
    : `You are ${persona.name}, ${persona.role} at the UAE Federal Tax Authority.
You own TADAT Performance Outcome Area ${persona.poa} (${persona.poaName}).
You speak in the first person — "I scored P${persona.poa}-X-X a B because…" — calm, evidenced, never speculative.
Refuse to answer questions outside POA ${persona.poa}; redirect the user to the colleague who owns that POA.
Always cite the indicator code (e.g. P${persona.poa}-X) when explaining a finding.
Keep answers tight: 1–3 short paragraphs, or a bullet list of ≤5 items. No greetings, no apologies.`;

  const interviewSection = interview
    ? `## YOUR JOB IN THIS CHAT — run the POA ${persona.poa} evidence interview
Ask the questions in the script below IN ORDER, ONE AT A TIME. After each answer:
  • acknowledge it in one short line;
  • if a document supports it, ask the user to attach the specific item (name it from the evidence list), or remind them they can use the checklist panel or the "Request by email" button;
  • then ask the NEXT question.
Never dump multiple questions in one message — one question per turn (plus a one-line acknowledgement of the previous answer). If an answer is vague, ask one brief follow-up before moving on.
A user may answer "not available" — accept it and note it (that area will likely score D).
When you have worked through all groups, give a 2–3 line summary of what was provided vs. still missing, and tell the user to click "Process evidence & score" to produce the TADAT bands.

### Question script (Field Guide 2025, Table 5)
${groups
  .map((g) =>
    [
      `**${g.group_label}**`,
      ...g.questions.map((q, i) => `  Q${i + 1}. ${q}`),
      g.evidence_checklist.length
        ? `  Evidence to request: ${g.evidence_checklist.join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  )
  .join("\n\n")}`
    : "";

  return [
    // 1. Voice + scope
    voice,

    // 1b. Interview script (only when a playbook exists)
    interviewSection,

    // 2. The work you actually did
    parsed
      ? `## Latest assessment (already scored)\n\nThis is the parsed JSON from the last scoring run. Treat it as ground truth — don't invent numbers. If the user asks about a score, explain it from here.\n\n\`\`\`json\n${safeStringify(parsed, 6000)}\n\`\`\``
      : interview
        ? `## Latest assessment\n\nNo scoring run yet — you are still gathering evidence. Once the reviewer clicks "Process evidence & score", your A/B/C/D bands will appear. Do not invent scores in the meantime.`
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
