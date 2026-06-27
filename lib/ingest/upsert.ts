import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { KBChunk, KBItem } from "@/lib/types";

/**
 * Mirrors the local snapshot into Firestore when credentials are
 * configured. Returns false (no-op) when env vars are missing so
 * `npm run ingest` still works against the local snapshot alone during
 * development. Firestore is schemaless — collections are created
 * implicitly on first write, no migration step needed.
 */
export async function upsertToFirestoreIfConfigured(
  items: KBItem[],
  chunks: KBChunk[]
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  const db = getDb();
  const batch = db.batch();

  for (const item of items) {
    const ref = db.collection("kb_items").doc(item.id);
    batch.set(ref, {
      title: item.title,
      source_ref: item.source_ref,
      raw_text: item.raw_text,
      status: item.status,
      updated_at: item.updated_at,
    });
  }

  for (const chunk of chunks) {
    const ref = db.collection("kb_chunks").doc(chunk.id);
    batch.set(ref, {
      kb_item_id: chunk.kb_item_id,
      content: chunk.content,
      embedding: chunk.embedding,
      citation_label: chunk.citation_label,
      tokens: chunk.tokens,
    });
  }

  await batch.commit();
  return true;
}
