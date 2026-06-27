import { NextRequest, NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Architect #4 return-path: when staff resolve an escalation, their answer
 * + the originating question become a draft kb_item linked via
 * unanswered_logs.kb_item_id. This is the loop that makes the automation
 * rate climb week over week (AC6) — without it, KB improvement is manual
 * and undocumented.
 *
 * Drafts must be reviewed/published (status -> 'published') before the
 * Retriever snapshot picks them up (re-run `npm run ingest`, or a future
 * publish step re-embeds and re-snapshots automatically).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const escalationId = body?.escalationId;
  const unansweredLogId = body?.unansweredLogId;
  const question = body?.question;
  const staffAnswer = body?.staffAnswer;
  const staffId = body?.staffId ?? null;

  if (!escalationId || !question || !staffAnswer) {
    return NextResponse.json(
      { error: "escalationId, question, and staffAnswer are required" },
      { status: 400 }
    );
  }

  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase not configured — cannot persist resolution" },
      { status: 500 }
    );
  }

  const db = getDb();

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
