import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { AnswerRoute } from "@/lib/types";
import { matchesRealtimeDenylist } from "./denylist";
import type { RetrievalResult } from "./retriever";

/**
 * The central tuned parameter (Architect tension): cite-or-escalate (P1)
 * vs the 50% automation target (AC2) conflict directly. This default must
 * be empirically replaced by running `npm run eval` against the held-out
 * eval set — never guessed. See ADR.
 */
export function getSimilarityThreshold(): number {
  const raw = process.env.RAG_SIMILARITY_THRESHOLD;
  const parsed = raw ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0.72;
}

export interface RoutingDecision {
  route: AnswerRoute;
  reason: string;
}

/**
 * Coverage-gating + denylist (Architect #2): real-time inventory/booking
 * questions are denylisted directly; everything else is gated purely on
 * retrieval coverage. Static KB content naturally scores low for questions
 * it has no content for, so no separate intent classifier is needed.
 */
export function decideRoute(question: string, retrieval: RetrievalResult): RoutingDecision {
  if (matchesRealtimeDenylist(question)) {
    return { route: "human_routed", reason: "matched real-time inventory/booking denylist" };
  }

  const threshold = getSimilarityThreshold();
  if (retrieval.chunks.length === 0 || retrieval.topScore < threshold) {
    return {
      route: "escalated",
      reason: `low retrieval coverage (topScore=${retrieval.topScore.toFixed(3)} < threshold=${threshold})`,
    };
  }

  return { route: "answered", reason: `covered (topScore=${retrieval.topScore.toFixed(3)})` };
}

/**
 * Writes the observability record (P4) that the escalation return-path
 * (Architect #4, Phase 3) later resolves into a draft kb_item. Returns the
 * created doc's id so the caller can thread it through to the escalation
 * record — without this id, /api/escalate/resolve has no row to link the
 * eventual draft kb_item back to, and the return-path loop never closes.
 */
export async function logUnanswered(
  question: string,
  topScore: number,
  route: AnswerRoute
): Promise<string | null> {
  if (route === "answered") return null; // only log gaps, not successful automations

  if (!isFirebaseConfigured()) {
    console.warn("[unanswered_logs] Firebase not configured — skipping persistence:", {
      question,
      topScore,
      route,
    });
    return null;
  }

  try {
    const db = getDb();
    const ref = await db.collection("unanswered_logs").add({
      question,
      top_score: topScore,
      route,
      kb_item_id: null,
      created_at: new Date().toISOString(),
    });
    return ref.id;
  } catch (err) {
    console.error("[unanswered_logs] insert failed:", (err as Error).message);
    return null;
  }
}
