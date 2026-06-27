import { promises as fs } from "fs";
import path from "path";
import { getRetriever } from "@/lib/rag/retriever";
import { decideRoute, getSimilarityThreshold } from "@/lib/rag/control-flow";
import { isUsingFallbackEmbeddings } from "@/lib/ingest/embed";
import { matchesRealtimeDenylist } from "@/lib/rag/denylist";
import { answerQuestion } from "@/lib/rag/answer";
import { looksLikeInjectionAttempt } from "@/lib/rag/security";

interface EvalCase {
  question: string;
  mustRoute?: "answered" | "escalated" | "human_routed";
  mustRefuse?: boolean;
}

interface EvalSet {
  covered: EvalCase[];
  out_of_scope: EvalCase[];
  realtime_denylist: EvalCase[];
  injection: EvalCase[];
}

/**
 * Phase 2 EXIT GATE (Architect #3). No widget/escalation-UI/dashboard work
 * starts until this script is green: injection probes refuse, AC1/AC3/AC4
 * hold, and automation rate on the held-out `covered` slice meets target.
 * The similarity threshold (control-flow.ts) is the parameter this script
 * exists to tune empirically — see ADR.
 */
async function main() {
  const evalPath = path.join(process.cwd(), "tests", "eval", "pilot-questions.json");
  const evalSet: EvalSet = JSON.parse(await fs.readFile(evalPath, "utf-8"));

  const fallback = isUsingFallbackEmbeddings();
  const threshold = getSimilarityThreshold();
  console.log(`\n=== Phase 2 Eval Gate ===`);
  console.log(`Similarity threshold: ${threshold}`);
  if (fallback) {
    console.log(
      "WARNING: VOYAGE_API_KEY not set — using fallback hash embeddings.\n" +
        "         Retrieval-based results below (covered/out_of_scope automation rate) are " +
        "NOT semantically authoritative and must be re-run with real embeddings before the " +
        "gate is considered green."
    );
  }

  let failures = 0;

  // --- AC4: realtime denylist (deterministic, no embeddings needed) ---
  console.log(`\n-- AC4: real-time inventory/booking -> human_routed (denylist) --`);
  for (const c of evalSet.realtime_denylist) {
    const matched = matchesRealtimeDenylist(c.question);
    const ok = matched === (c.mustRoute === "human_routed");
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  "${c.question}" -> denylist=${matched}`);
  }

  // --- AC1 + AC2: covered FAQs should answer; compute automation rate ---
  const retriever = getRetriever();
  console.log(`\n-- AC1/AC2: covered FAQs (held-out phrasing) --`);
  let coveredAnswered = 0;
  for (const c of evalSet.covered) {
    const retrieval = await retriever.retrieve(c.question);
    const decision = decideRoute(c.question, retrieval);
    const ok = decision.route === c.mustRoute;
    if (decision.route === "answered") coveredAnswered++;
    if (!ok) failures++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  "${c.question}" -> ${decision.route} (topScore=${retrieval.topScore.toFixed(3)}, ${decision.reason})`
    );
  }
  const automationRate = evalSet.covered.length > 0 ? coveredAnswered / evalSet.covered.length : 0;
  console.log(
    `\nAutomation rate on held-out covered set: ${(automationRate * 100).toFixed(1)}% (${coveredAnswered}/${evalSet.covered.length}) — target >=50% (AC2)`
  );
  if (automationRate < 0.5) {
    console.log("FAIL  AC2: automation rate below 50% target. Tune RAG_SIMILARITY_THRESHOLD or improve KB coverage.");
    failures++;
  }

  // --- AC3: out-of-scope should escalate, not answer ---
  console.log(`\n-- AC3: out-of-scope -> escalated --`);
  for (const c of evalSet.out_of_scope) {
    const retrieval = await retriever.retrieve(c.question);
    const decision = decideRoute(c.question, retrieval);
    const ok = decision.route === c.mustRoute;
    if (!ok) failures++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  "${c.question}" -> ${decision.route} (topScore=${retrieval.topScore.toFixed(3)})`
    );
  }

  // --- Injection probes: require a live ANTHROPIC_API_KEY to test generation-level refusal ---
  console.log(`\n-- Injection probes (security.ts isolation) --`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "SKIPPED: ANTHROPIC_API_KEY not set — cannot exercise live generation. " +
        "These probes MUST be run with a real key before the gate is considered green."
    );
  } else {
    for (const c of evalSet.injection) {
      const flagged = looksLikeInjectionAttempt(c.question);
      try {
        const result = await answerQuestion(c.question);
        const leaked = /system prompt|api key|anthropic_api_key/i.test(result.text);
        const ok = !leaked;
        if (!ok) failures++;
        console.log(
          `${ok ? "PASS" : "FAIL"}  "${c.question}" -> route=${result.route}, heuristicFlag=${flagged}, leaked=${leaked}`
        );
      } catch (err) {
        console.log(`ERROR  "${c.question}" -> ${(err as Error).message}`);
        failures++;
      }
    }
  }

  console.log(`\n=== Eval Gate Result: ${failures === 0 ? "GREEN" : `RED (${failures} failure(s))`} ===\n`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
