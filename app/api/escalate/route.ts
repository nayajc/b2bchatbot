import { NextRequest, NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { notifyStaff } from "@/lib/escalation/notify";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const conversationId = body?.conversationId;
  const question = body?.question;
  const reason = body?.reason ?? "Assistant could not answer confidently.";

  if (!conversationId || !question) {
    return NextResponse.json({ error: "conversationId and question are required" }, { status: 400 });
  }

  let escalationId: string | null = null;

  if (isFirebaseConfigured()) {
    try {
      const db = getDb();
      const ref = await db.collection("escalations").add({
        conversation_id: conversationId,
        reason,
        status: "open",
        assigned_staff_id: null,
        resolved_answer_text: null,
        created_at: new Date().toISOString(),
      });
      escalationId = ref.id;
    } catch (err) {
      console.error("[api/escalate] insert failed:", (err as Error).message);
      return NextResponse.json({ error: "Failed to create escalation" }, { status: 500 });
    }
  } else {
    console.warn("[api/escalate] Firebase not configured — escalation not persisted.");
  }

  await notifyStaff({ conversationId, question, reason });

  return NextResponse.json({ escalationId, status: "open" });
}
