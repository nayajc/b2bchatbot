import { getPilotMetrics } from "@/lib/metrics";
import { isFirebaseConfigured } from "@/lib/firebase";

// Same static-rendering pitfall as /staff/escalations — metrics must be
// queried fresh on every request, not frozen at build time.
export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const { metrics, clusters } = await getPilotMetrics();
  const firebaseConfigured = isFirebaseConfigured();

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-xl font-semibold">Pilot Metrics</h1>
      <p className="mt-1 text-sm text-gray-600">
        Automation rate (AC2) + top KB gaps feeding the escalation return-path (AC6).
      </p>

      {!firebaseConfigured && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          Firebase is not configured — metrics require live data. Run the pilot with real
          credentials to populate this dashboard.
        </p>
      )}

      {metrics && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="border rounded p-4">
            <div className="text-2xl font-semibold">{metrics.automationRatePct}%</div>
            <div className="text-xs text-gray-500">Automation rate (target ≥50%)</div>
          </div>
          <div className="border rounded p-4">
            <div className="text-2xl font-semibold">{metrics.totalCount}</div>
            <div className="text-xs text-gray-500">Total questions</div>
          </div>
          <div className="border rounded p-4">
            <div className="text-lg font-semibold">{metrics.escalatedCount}</div>
            <div className="text-xs text-gray-500">Escalated (low coverage)</div>
          </div>
          <div className="border rounded p-4">
            <div className="text-lg font-semibold">{metrics.humanRoutedCount}</div>
            <div className="text-xs text-gray-500">Human-routed (real-time)</div>
          </div>
        </div>
      )}

      <h2 className="mt-8 text-lg font-medium">Top unanswered clusters</h2>
      <ul className="mt-3 divide-y divide-gray-200">
        {clusters.map((c, i) => (
          <li key={i} className="py-3 flex items-center justify-between text-sm">
            <span>{c.question}</span>
            <span className="text-gray-500">
              ×{c.occurrences} · best score {c.bestScore.toFixed(2)}
            </span>
          </li>
        ))}
        {clusters.length === 0 && (
          <li className="py-3 text-sm text-gray-500">No unanswered questions logged yet.</li>
        )}
      </ul>
    </main>
  );
}
