import { getDb, isFirebaseConfigured } from "@/lib/firebase";

export interface PilotMetrics {
  answeredCount: number;
  escalatedCount: number;
  humanRoutedCount: number;
  totalCount: number;
  automationRatePct: number;
}

export interface UnansweredCluster {
  question: string;
  occurrences: number;
  bestScore: number;
  lastSeen: string;
}

/**
 * Right-sized Phase 5 (Architect #7): Firestore has no SQL views, so this
 * is the single aggregation function the admin page calls — equivalent
 * scope to the one-view-plus-one-page design, just computed in code.
 * Pilot volume (tens-hundreds of docs) makes full-collection reads fine;
 * revisit with count() aggregation queries if volume grows materially.
 */
export async function getPilotMetrics(): Promise<{
  metrics: PilotMetrics | null;
  clusters: UnansweredCluster[];
}> {
  if (!isFirebaseConfigured()) {
    return { metrics: null, clusters: [] };
  }

  const db = getDb();
  const [answersSnap, gapsSnap] = await Promise.all([
    db.collection("answers").where("route", "==", "answered").count().get(),
    db.collection("unanswered_logs").get(),
  ]);

  const answeredCount = answersSnap.data().count;
  let escalatedCount = 0;
  let humanRoutedCount = 0;
  const clusterMap = new Map<string, { occurrences: number; bestScore: number; lastSeen: string }>();

  for (const doc of gapsSnap.docs) {
    const data = doc.data() as { question: string; top_score: number; route: string; created_at: string };
    if (data.route === "escalated") escalatedCount++;
    if (data.route === "human_routed") humanRoutedCount++;

    const existing = clusterMap.get(data.question);
    if (existing) {
      existing.occurrences += 1;
      existing.bestScore = Math.max(existing.bestScore, data.top_score);
      if (data.created_at > existing.lastSeen) existing.lastSeen = data.created_at;
    } else {
      clusterMap.set(data.question, {
        occurrences: 1,
        bestScore: data.top_score,
        lastSeen: data.created_at,
      });
    }
  }

  const totalCount = answeredCount + gapsSnap.size;
  const automationRatePct = totalCount === 0 ? 0 : Math.round((answeredCount / totalCount) * 1000) / 10;

  const clusters: UnansweredCluster[] = Array.from(clusterMap.entries())
    .map(([question, v]) => ({ question, occurrences: v.occurrences, bestScore: v.bestScore, lastSeen: v.lastSeen }))
    .sort((a, b) => b.occurrences - a.occurrences || (b.lastSeen > a.lastSeen ? 1 : -1))
    .slice(0, 10);

  return {
    metrics: {
      answeredCount,
      escalatedCount,
      humanRoutedCount,
      totalCount,
      automationRatePct,
    },
    clusters,
  };
}
