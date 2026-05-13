/**
 * POST /api/upload/run
 *
 * Server-sent events stream for the /upload page. Fires all 5 TADAT
 * agents in parallel against the seeded DB and emits SSE events as each
 * stage transitions (start → done | error). Closes with a `complete`
 * event carrying the aggregate AED rolled up across stages.
 *
 * For the POC the uploaded file is theatrical — agents read the same
 * SQLite the /lifecycle page does. Wall-clock = max(agent durations) ≈
 * 25–35 s, well inside the demo budget.
 */
import { runAgent, type WorkflowId } from "@/lib/agents/run-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGE_ORDER: WorkflowId[] = [
  "registry",
  "risk",
  "service",
  "filing",
  "payments",
];

function pullScore(parsed: Record<string, unknown> | null): string | undefined {
  if (!parsed) return undefined;
  return (
    (parsed.poa_aggregate_score as string | undefined) ??
    (parsed.aggregate_score as string | undefined)
  );
}

function pullOutcome(parsed: Record<string, unknown> | null): string | undefined {
  if (!parsed) return undefined;
  const bo = parsed.business_outcome as string | undefined;
  if (bo && bo.length > 0) return bo;
  const recs = parsed.recommendations as string[] | undefined;
  return recs && recs.length > 0 ? recs[0] : undefined;
}

function pullRecoverable(
  id: WorkflowId,
  parsed: Record<string, unknown> | null,
): number | null {
  if (!parsed) return null;
  if (id === "filing") {
    const wl = parsed.non_filer_worklist as
      | { highest_value_aed?: number; total_aed_outstanding?: number }
      | undefined;
    return wl?.total_aed_outstanding ?? wl?.highest_value_aed ?? null;
  }
  if (id === "risk") {
    const top =
      (parsed.risk_register_top as Array<{
        estimated_aed_at_risk?: number | null;
      }> | undefined) ?? [];
    const sum = top.reduce((s, r) => s + (r.estimated_aed_at_risk ?? 0), 0);
    return sum > 0 ? sum : null;
  }
  if (id === "payments") {
    const debtors =
      (parsed.high_risk_debtors as Array<{ outstanding_aed?: number }> | undefined) ??
      [];
    const sum = debtors.reduce((s, d) => s + (d.outstanding_aed ?? 0), 0);
    return sum || null;
  }
  return null;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  // Body may include a `uploaded_file` payload parsed by /api/upload/parse —
  // when present, agents include it in their LLM input so headlines reflect
  // what the reviewer dropped, not just the Supabase aggregates.
  let uploadedFile: unknown = null;
  try {
    const body = await req.json();
    if (body && typeof body === "object") {
      uploadedFile = (body as { uploaded_file?: unknown }).uploaded_file ?? null;
    }
  } catch {
    // Empty / non-JSON body — that's fine, run with seeded data only
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15_000);

      try {
        send("start", { stages: STAGE_ORDER });

        // Mark all stages as queued/running up-front so the UI can paint
        // every tile in flight immediately.
        for (const id of STAGE_ORDER) send("stage_start", { id });

        let aggregateAed = 0;
        let recoveredAny = false;

        // Fire all 5 in parallel; emit completion events as each settles.
        await Promise.all(
          STAGE_ORDER.map(async (id) => {
            try {
              const r = await runAgent(id, { uploadedFile });
              if (!r.ok || !r.parsed) {
                send("stage_error", {
                  id,
                  error: r.parse_error ?? "agent failed",
                  duration_ms: r.duration_ms,
                });
                return;
              }
              const score = pullScore(r.parsed);
              const outcome = pullOutcome(r.parsed);
              const recoverable = pullRecoverable(id, r.parsed);
              if (typeof recoverable === "number") {
                aggregateAed += recoverable;
                recoveredAny = true;
              }
              send("stage_done", {
                id,
                poa: r.poa,
                score,
                outcome,
                recoverable_aed: recoverable,
                duration_ms: r.duration_ms,
                inputs: r.inputs,
                parsed: r.parsed,
              });
            } catch (e) {
              send("stage_error", { id, error: (e as Error).message });
            }
          }),
        );

        send("complete", {
          aggregate_aed: recoveredAny ? aggregateAed : null,
        });
      } catch (e) {
        send("fatal", { error: (e as Error).message });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
