import { getDb, isFirebaseConfigured } from "@/lib/firebase";

interface EscalationRow {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  conversation_id: string;
}

async function getOpenEscalations(): Promise<EscalationRow[]> {
  if (!isFirebaseConfigured()) return [];

  try {
    const db = getDb();
    const snapshot = await db
      .collection("escalations")
      .where("status", "!=", "closed")
      .orderBy("status")
      .orderBy("created_at", "desc")
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<EscalationRow, "id">) }));
  } catch (err) {
    console.error("[staff/escalations] query failed:", (err as Error).message);
    return [];
  }
}

export default async function StaffEscalationsPage() {
  const escalations = await getOpenEscalations();
  const firebaseConfigured = isFirebaseConfigured();

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-xl font-semibold">Open Escalations</h1>
      <p className="mt-1 text-sm text-gray-600">
        Resolving an escalation via <code>POST /api/escalate/resolve</code> creates a draft KB
        item linked back to the question that exposed the gap.
      </p>

      {!firebaseConfigured && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          Firebase is not configured (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
          FIREBASE_PRIVATE_KEY) — this page cannot list real escalations until those env vars are
          set.
        </p>
      )}

      <ul className="mt-6 divide-y divide-gray-200">
        {escalations.map((e) => (
          <li key={e.id} className="py-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{e.reason}</span>
              <span className="text-xs uppercase tracking-wide text-gray-500">{e.status}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Conversation {e.conversation_id} · {new Date(e.created_at).toLocaleString()}
            </div>
          </li>
        ))}
        {escalations.length === 0 && firebaseConfigured && (
          <li className="py-4 text-sm text-gray-500">No open escalations.</li>
        )}
      </ul>
    </main>
  );
}
