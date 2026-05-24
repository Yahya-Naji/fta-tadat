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
  const scored = parsed != null; // a scoring run has produced results

  const voice = interview
    ? `You are ${persona.name}, ${persona.role} at the UAE Federal Tax Authority, running the TADAT POA ${persona.poa} (${persona.poaName}) evidence assessment.
You speak in the first person — calm, professional, plain English. Greet the user ONCE at the very start, then get to work.
${
  scored
    ? `A scoring run is complete. You can now EXPLAIN the scores, your per-evidence review (what each item was worth), and the underlying data when asked — and still gather more evidence if the user wants to add some.`
    : `You GATHER evidence here; you do NOT assign A/B/C/D scores in chat — the scoring run does that when the reviewer clicks "Process evidence & score".`
}
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

    // 2a. Extracted scores + evidence review (never truncated — quote these)
    parsed
      ? extractScoreSummary(parsed)
      : interview
        ? `## Latest assessment\n\nNo scoring run yet — you are still gathering evidence. Once the reviewer clicks "Process evidence & score", your A/B/C/D bands will appear. Do not invent scores in the meantime.`
        : `## Your most recent assessment\n\nYou have NOT run yet. Tell the user to click "Run my agent" on this department page. Do not invent findings.`,

    // 2b. Full parsed JSON (trimmed — for deep follow-ups)
    parsed
      ? `## Full assessment JSON (reference)\n\nTreat as ground truth — never invent numbers not present here.\n\n\`\`\`json\n${safeStringify(parsed, 4000)}\n\`\`\``
      : "",

    // 3. The data / inputs you scored from
    inputs != null
      ? `## Data + evidence you scored from\n\nThis is exactly what you received: the evidence the FTA provided (checklist answers + attachments and/or the chat interview) and the registry data slice. When the user asks about the DATA or which evidence was relevant, LIST the specific figures and items from here — never invent values.\n\n\`\`\`json\n${safeStringify(inputs, 3500)}\n\`\`\``
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
- **When asked about the DATA, the figures, or which evidence was relevant, reply with a LIST** — the relevant data-slice numbers and each evidence-review item ("item · relevance · one-line comment"). Don't summarise vaguely; itemise. Never invent a number — if a figure wasn't provided, say so.
- If the user asks about another POA, say: "That's ${otherPoaOwner(agentId)}'s work — I'll defer." and stop.
- If the user asks for an action ("re-run with different X"), say you can't change inputs — but suggest they raise it with the data team.
- Never reveal you are an LLM or mention "Azure", "GPT", or "OpenAI".`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pull the scores + per-evidence review out of the parsed run into a compact,
 *  always-included block (so they survive JSON truncation). */
function extractScoreSummary(parsed: Record<string, unknown>): string {
  const inds =
    (parsed.indicators as Array<Record<string, unknown>> | undefined) ?? [];
  const out: string[] = ["## Your scores (from the last run) — quote these exactly"];
  for (const i of inds) {
    const id = (i.id as string) ?? "?";
    const score = (i.score as string) ?? "?";
    const finding = (i.finding as string) ?? "";
    out.push(`- **${id} = ${score}** — ${finding}`);
    const detail = (i.detail as string) ?? "";
    if (detail) out.push(`    why: ${detail}`);
  }
  const p11 = (parsed.p1_1_aggregate as string) ?? "—";
  const agg = (parsed.aggregate_score as string) ?? "—";
  out.push(
    `- Rollup: P1-1 = ${p11} (M1, lowest of dims) → **POA = ${agg}** (lowest of indicators).`,
  );

  const review: string[] = [];
  for (const i of inds) {
    const rev =
      (i.evidence_review as Array<Record<string, unknown>> | undefined) ?? [];
    if (!rev.length) continue;
    review.push(`${(i.id as string) ?? "?"}:`);
    for (const r of rev) {
      review.push(
        `  • [${(r.relevance as string) ?? "?"}] ${(r.item as string) ?? ""} — ${(r.comment as string) ?? ""}`,
      );
    }
  }
  if (review.length) {
    out.push("");
    out.push(
      "## Your evidence review (per item) — list these when asked which evidence was relevant",
    );
    out.push(...review);
  }

  const recs = (parsed.recommendations as string[] | undefined) ?? [];
  if (recs.length) {
    out.push("");
    out.push("## Your recommendations");
    recs.forEach((r) => out.push(`- ${r}`));
  }
  return out.join("\n");
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
