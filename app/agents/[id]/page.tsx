/**
 * /agents/[id] — full TADAT assessment page per agent.
 *
 * Karim (filing / POA 4) keeps his bespoke <KarimView /> — by design,
 * untouched.
 *
 * Layla (registry), Hamad (risk), Maya (service), Salma (payments) share
 * the AgentDetailView shell. The page hydrates the view from the canonical
 * SAMPLE_RUN fixture so the cold load is reviewer-ready; clicking
 * "Run live" round-trips /api/agents/{id}/run and replaces in place.
 */
import { notFound } from "next/navigation";

import { KarimView } from "@/components/agents/KarimView";
import { DepartmentDashboard } from "@/components/agents/DepartmentDashboard";
import { SAMPLE_RUN, type SampleStage } from "@/lib/fixtures/sample-run";

const AGENT_IDS = ["registry", "risk", "service", "filing", "payments"] as const;
type AgentId = (typeof AGENT_IDS)[number];

function isAgentId(x: string): x is AgentId {
  return (AGENT_IDS as readonly string[]).includes(x);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stage: SampleStage | undefined = SAMPLE_RUN.stages.find(
    (s) => s.id === id,
  );
  if (!stage) return { title: "Agent not found · FTA" };
  return {
    title: `${stage.persona} — ${stage.step_label} · POA ${stage.poa} · FTA`,
    description: stage.business_outcome,
  };
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isAgentId(id)) notFound();

  // Karim has his own bespoke view — never replace it.
  if (id === "filing") {
    return <KarimView />;
  }

  const stage = SAMPLE_RUN.stages.find((s) => s.id === id);
  if (!stage) notFound();

  return <DepartmentDashboard stage={stage} />;
}
