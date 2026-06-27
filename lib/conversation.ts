import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { ChatAnswer } from "@/lib/rag/answer";

/**
 * Persists conversation/message/answer turns to Firestore. Kept separate
 * from lib/rag/answer.ts (which stays pure I/O-light for the eval gate) —
 * this is what lets app/admin/metrics aggregate a real automation rate
 * from the "answers" collection instead of only unanswered_logs.
 */
export async function recordTurn(
  conversationId: string | null,
  question: string,
  answer: ChatAnswer
): Promise<string | null> {
  if (!isFirebaseConfigured()) return conversationId;

  const db = getDb();
  let convId = conversationId;

  if (!convId) {
    const convRef = await db.collection("conversations").add({
      channel: "widget",
      created_at: new Date().toISOString(),
    });
    convId = convRef.id;
  }

  const messageRef = await db.collection("messages").add({
    conversation_id: convId,
    role: "user",
    content: question,
    created_at: new Date().toISOString(),
  });

  await db.collection("answers").add({
    message_id: messageRef.id,
    text: answer.text,
    confidence: answer.topScore,
    cited_chunk_ids: answer.citedChunks.map((c) => c.id),
    route: answer.route,
  });

  return convId;
}
