/**
 * GET /api/agents/[id]/preview
 *
 * Returns ONLY the pre-aggregated SQL inputs an agent would receive,
 * without calling the LLM. Used by the agent UI to render the "Coverage"
 * panel and by tests to verify data shape.
 */
import { NextResponse } from "next/server";
import {
  aggregateRegistry,
  aggregateFiling,
  aggregatePayments,
  aggregateRiskMgmt,
  aggregateFacilitation,
} from "@/lib/tadat/aggregations";

const AGGREGATORS: Record<string, () => unknown> = {
  registry: aggregateRegistry,
  filing: aggregateFiling,
  payments: aggregatePayments,
  risk: aggregateRiskMgmt,
  service: aggregateFacilitation,
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const agg = AGGREGATORS[id];
  if (!agg) {
    return NextResponse.json(
      { success: false, error: `Unknown agent id: ${id}` },
      { status: 400 }
    );
  }
  try {
    const inputs = agg();
    return NextResponse.json({ success: true, agent_id: id, inputs });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
