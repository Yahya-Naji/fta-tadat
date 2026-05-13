/**
 * CLI test harness — runs all 3 TADAT workflows end-to-end against the DB.
 *
 *   npm run agents:test               # all 3 workflows
 *   npm run agents:test -- registry   # single workflow
 *
 * For each workflow it:
 *   1. Pre-aggregates DB (real SQL on data/tadat-fta.db)
 *   2. Calls Azure OpenAI (gpt-4o-mini) with the workflow's system prompt
 *   3. Parses the JSON response
 *   4. Prints a structured terminal trace: BEFORE → AFTER
 */
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" });

// Dynamic import AFTER dotenv runs so lib/config.ts sees the loaded vars.
type Mod = typeof import("../lib/agents/run-agent");
type AgentRunResult = import("../lib/agents/run-agent").AgentRunResult;
type WorkflowId = import("../lib/agents/run-agent").WorkflowId;

// Pretty terminal helpers (no extra deps)
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function bar(char = "═", n = 78) {
  return char.repeat(n);
}
function scoreColor(s: string | undefined): string {
  if (!s) return C.gray;
  if (s.startsWith("A")) return C.green;
  if (s.startsWith("B")) return C.blue;
  if (s.startsWith("C")) return C.yellow;
  return C.red;
}

function renderResult(r: AgentRunResult) {
  console.log("\n" + C.bold + bar() + C.reset);
  console.log(
    `  ${C.cyan}${C.bold}Workflow ${r.workflow.toUpperCase()}${C.reset} · ` +
      `${C.bold}${r.workflow_name}${C.reset} ${C.gray}(POA ${r.poa})${C.reset}`
  );
  console.log("  " + C.gray + bar("─") + C.reset);

  if (!r.ok) {
    console.log(`  ${C.red}✗ FAILED${C.reset}`);
    console.log(`  ${C.gray}error:${C.reset} ${r.parse_error}`);
    if (r.raw_response) {
      console.log(`  ${C.gray}raw response (first 500 chars):${C.reset}\n  ${r.raw_response.slice(0, 500)}`);
    }
    return;
  }

  const p = r.parsed!;
  const score = (p.aggregate_score as string) ?? "—";
  console.log(
    `  ${C.bold}Aggregate score:${C.reset} ${scoreColor(score)}${C.bold}${score}${C.reset}` +
      `   ${C.gray}(${r.duration_ms}ms)${C.reset}`
  );

  // Indicators
  const inds = (p.indicators as Array<Record<string, unknown>>) ?? [];
  if (inds.length) {
    console.log(`\n  ${C.bold}Indicators:${C.reset}`);
    for (const ind of inds) {
      const id = ind.id as string;
      const name = ind.name as string;
      const sc = ind.score as string;
      const val =
        (ind.value as number | null) ??
        (ind.value_all as number | null) ??
        null;
      const valStr = val != null ? `${val}` : "—";
      console.log(
        `    ${scoreColor(sc)}${sc}${C.reset}  ${C.bold}${id}${C.reset}  ${name.slice(0, 50).padEnd(50)} ${C.gray}value=${valStr}${C.reset}`
      );
      if (ind.finding) {
        console.log(`        ${C.dim}${(ind.finding as string).slice(0, 120)}${C.reset}`);
      }
    }
  }

  // Recommendations
  const recs = (p.recommendations as string[]) ?? [];
  if (recs.length) {
    console.log(`\n  ${C.bold}Recommendations:${C.reset}`);
    for (const rec of recs.slice(0, 5)) {
      console.log(`    ${C.cyan}→${C.reset} ${rec.slice(0, 130)}`);
    }
  }

  // NA dimensions
  const na = (p.not_applicable as Array<Record<string, string>>) ?? [];
  if (na.length) {
    console.log(`\n  ${C.gray}Not applicable to UAE:${C.reset}`);
    for (const item of na) {
      console.log(`    ${C.gray}· ${item.id}: ${item.reason}${C.reset}`);
    }
  }

  // Worklists
  if (p.non_filer_worklist) {
    const wl = p.non_filer_worklist as Record<string, unknown>;
    console.log(`\n  ${C.yellow}Non-filer worklist:${C.reset} ${wl.total_cases} cases · highest AED ${wl.highest_value_aed}`);
  }
  if (p.high_risk_debtors) {
    const dl = p.high_risk_debtors as Array<Record<string, unknown>>;
    console.log(`\n  ${C.yellow}Top high-risk debtors (${dl.length}):${C.reset}`);
    for (const d of dl.slice(0, 3)) {
      console.log(
        `    ${C.gray}…${(d.trn as string).slice(-6)}${C.reset}  AED ${(d.outstanding_aed as number).toLocaleString()}  ${d.age_bucket}  ${d.collectible ? "collectible" : "uncollectible"}`
      );
    }
  }
}

async function main() {
  const { runAgent }: Mod = await import("../lib/agents/run-agent");
  const arg = process.argv[2] as WorkflowId | undefined;
  const order: WorkflowId[] = ["registry", "filing", "payments"];
  const targets = arg ? [arg] : order;

  console.log("\n" + C.bold + C.magenta + bar() + C.reset);
  console.log(
    `  ${C.bold}TADAT FTA Agent Test Harness${C.reset} ${C.gray}· direct Azure OpenAI · no Autogen${C.reset}`
  );
  console.log(C.bold + C.magenta + bar() + C.reset);
  console.log(`  Running ${targets.length} workflow(s) against data/tadat-fta.db`);

  const results: AgentRunResult[] = [];
  for (const w of targets) {
    process.stdout.write(`\n  ${C.dim}⏳ ${w} ... ${C.reset}`);
    const t0 = Date.now();
    const r = await runAgent(w);
    process.stdout.write(`${C.green}done${C.reset} ${C.gray}(${Date.now() - t0}ms)${C.reset}\n`);
    results.push(r);
  }

  for (const r of results) renderResult(r);

  // Summary
  const ok = results.filter((r) => r.ok).length;
  const totalMs = results.reduce((s, r) => s + r.duration_ms, 0);
  console.log("\n" + C.bold + bar() + C.reset);
  console.log(
    `  ${ok === results.length ? C.green : C.red}${ok}/${results.length} workflows succeeded${C.reset}` +
      `  ·  ${C.gray}${(totalMs / 1000).toFixed(1)}s total${C.reset}`
  );
  console.log(bar() + "\n");

  process.exit(ok === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("\n💥 Fatal:", e);
  process.exit(1);
});
