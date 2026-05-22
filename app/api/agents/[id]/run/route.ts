/**
 * POST /api/agents/[id]/run
 *
 * Runs the requested TADAT workflow (registry | filing | payments) end-to-end:
 *   1. Pre-aggregate from SQLite (deterministic SQL)
 *   2. Send to the OpenAI Agents SDK agent (gpt-4o-mini via Azure)
 *   3. Parse the JSON response
 *   4. Return inputs + parsed score + raw response
 *
 * Replaces the earlier Autogen-based path. The Quanterra team JSONs in
 * quanterra_teams/ remain available for the eventual full Autogen deploy.
 */
import { NextRequest, NextResponse } from "next/server";
import { runAgent, type WorkflowId } from "@/lib/agents/run-agent";

const VALID: WorkflowId[] = ["registry", "filing", "payments", "risk", "service"];

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!VALID.includes(id as WorkflowId)) {
    return NextResponse.json(
      { success: false, error: `Unknown agent id: ${id}. Expected: ${VALID.join(" | ")}.` },
      { status: 400 }
    );
  }

  // Optional JSON body carrying the TADAT evidence intake bundle + chat
  // interview transcript.
  let evidenceBundle: unknown;
  let chatTranscript: unknown;
  try {
    const body = (await request.json()) as
      | { evidenceBundle?: unknown; chatTranscript?: unknown }
      | null;
    evidenceBundle = body?.evidenceBundle;
    chatTranscript = body?.chatTranscript;
  } catch {
    // no body / not JSON — fine (other agents post nothing)
  }

  const result = await runAgent(id as WorkflowId, {
    evidenceBundle,
    chatTranscript,
  });

  return NextResponse.json({
    success: result.ok,
    agent: result.workflow_name,
    poa: result.poa,
    duration_ms: result.duration_ms,
    inputs: result.inputs,
    raw_response: result.raw_response,
    parsed: result.parsed,
    parse_error: result.parse_error,
  });
}
