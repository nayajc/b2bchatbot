import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import EscalationItem, { type EscalationItemData } from "./escalation-item";

async function getOpenEscalations(): Promise<EscalationItemData[]> {
  if (!isFirebaseConfigured()) return [];

  try {
    const db = getDb();
    const snapshot = await db
      .collection("escalations")
      .where("status", "!=", "closed")
      .orderBy("status")
      .orderBy("created_at", "desc")
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<EscalationItemData, "id" | "question"> & { question?: string };
      return { id: doc.id, question: data.question || "(question not recorded)", ...data };
    });
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
        Answer below — your reply creates a draft KB item linked back to the question that
        exposed the gap, so the assistant can answer it automatically next time once published.
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
          <EscalationItem key={e.id} escalation={e} />
        ))}
        {escalations.length === 0 && firebaseConfigured && (
          <li className="py-4 text-sm text-gray-500">No open escalations.</li>
        )}
      </ul>
    </main>
  );
}
