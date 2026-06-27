import { NextRequest, NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Architect #4 return-path: when staff resolve an escalation, their answer
 * + the originating question become a draft kb_item linked via
 * unanswered_logs.kb_item_id. This is the loop that makes the automation
 * rate climb week over week (AC6) — without it, KB improvement is manual
 * and undocumented.
 *
 * `question` and `unansweredLogId` are read from the escalation doc itself
 * (stored at creation time in /api/escalate) rather than trusted from the
 * client — the staff UI only needs to send escalationId + staffAnswer.
 *
 * Drafts must be reviewed/published (status -> 'published') before the
 * Retriever picks them up (re-run `npm run ingest` for local dev, or
 * publish + re-embed directly into kb_chunks for the Firestore-backed path).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const escalationId = typeof body?.escalationId === "string" ? body.escalationId : null;
  const staffAnswer = typeof body?.staffAnswer === "string" ? body.staffAnswer.trim() : "";
  const staffId = body?.staffId ?? null;

  if (!escalationId || !staffAnswer) {
    return NextResponse.json({ error: "escalationId and staffAnswer are required" }, { status: 400 });
  }

  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase not configured — cannot persist resolution" },
      { status: 500 }
    );
  }

  const db = getDb();

  const escalationSnap = await db.collection("escalations").doc(escalationId).get();
  if (!escalationSnap.exists) {
    return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
  }
  const escalation = escalationSnap.data() as { question?: string; unanswered_log_id?: string | null };
  const question = escalation.question;
  const unansweredLogId = escalation.unanswered_log_id ?? null;

  if (!question) {
    return NextResponse.json(
      { error: "Escalation has no stored question — cannot create a draft kb_item" },
      { status: 400 }
    );
  }

  let draftItemId: string;
  try {
    const draftRef = await db.collection("kb_items").add({
      title: question,
      source_ref: `escalation:${escalationId}`,
      raw_text: `Q: ${question}\nA: ${staffAnswer}`,
      status: "draft",
      updated_at: new Date().toISOString(),
    });
    draftItemId = draftRef.id;
  } catch (err) {
    console.error("[api/escalate/resolve] kb_item create failed:", (err as Error).message);
    return NextResponse.json({ error: "Failed to create draft kb_item" }, { status: 500 });
  }

  try {
    await db.collection("escalations").doc(escalationId).update({
      status: "closed",
      assigned_staff_id: staffId,
      resolved_answer_text: staffAnswer,
    });
  } catch (err) {
    console.error("[api/escalate/resolve] escalation update failed:", (err as Error).message);
  }

  if (unansweredLogId) {
    try {
      await db.collection("unanswered_logs").doc(unansweredLogId).update({ kb_item_id: draftItemId });
    } catch (err) {
      console.error("[api/escalate/resolve] unanswered_log link failed:", (err as Error).message);
    }
  }

  return NextResponse.json({ draftKbItemId: draftItemId, status: "draft" });
}
