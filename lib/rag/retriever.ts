import { embedText } from "@/lib/ingest/embed";
import { readSnapshot } from "@/lib/ingest/snapshot";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { KBChunk } from "@/lib/types";

export interface RetrievedChunk {
  id: string;
  content: string;
  citationLabel: string;
  score: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  topScore: number;
}

/**
 * The Retriever contract (Architect #1 / ADR seam). At pilot scale (20-30
 * chunks) in-memory cosine over kb_chunk rows is plenty — no vector index,
 * no migration, no recall tuning. The corpus is loaded from Firestore when
 * configured (serverless deployments have no local filesystem snapshot) or
 * the local `.data/kb-snapshot.json` for offline dev. A future pgvector- or
 * Pinecone/Qdrant-backed implementation only needs to satisfy this same
 * interface; nothing above this layer changes.
 */
export interface Retriever {
  retrieve(query: string, topK?: number): Promise<RetrievalResult>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Per-warm-instance cache. Serverless deployments have no local
// .data/kb-snapshot.json (it's gitignored and never ships in the bundle) —
// Firestore is the corpus of record there. Caching avoids a Firestore read
// per request; it goes stale only when a serverless instance stays warm
// across a KB republish, which is an acceptable pilot-scale tradeoff
// (re-deploying or a cold start picks up the change).
let firestoreChunkCache: KBChunk[] | null = null;

async function loadCorpus(): Promise<KBChunk[]> {
  if (isFirebaseConfigured()) {
    if (firestoreChunkCache) return firestoreChunkCache;
    const db = getDb();
    const snapshot = await db.collection("kb_chunks").get();
    firestoreChunkCache = snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<KBChunk, "id">;
      return { id: doc.id, ...data };
    });
    return firestoreChunkCache;
  }

  const localSnapshot = await readSnapshot();
  return localSnapshot.chunks;
}

export class InMemoryCosineRetriever implements Retriever {
  async retrieve(query: string, topK = 3): Promise<RetrievalResult> {
    const corpus = await loadCorpus();
    if (corpus.length === 0) {
      return { chunks: [], topScore: 0 };
    }

    const queryEmbedding = await embedText(query);
    const scored = corpus
      .map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        citationLabel: chunk.citation_label,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score);

    const chunks = scored.slice(0, topK);
    return { chunks, topScore: chunks[0]?.score ?? 0 };
  }
}

let defaultRetriever: Retriever | null = null;

export function getRetriever(): Retriever {
  if (!defaultRetriever) {
    defaultRetriever = new InMemoryCosineRetriever();
  }
  return defaultRetriever;
}
