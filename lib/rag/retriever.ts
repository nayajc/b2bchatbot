import { embedText } from "@/lib/ingest/embed";
import { readSnapshot } from "@/lib/ingest/snapshot";

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
 * chunks) there is no in-memory cosine over kb_chunk rows — no vector
 * index, no migration, no recall tuning. A future pgvector- or
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

export class InMemoryCosineRetriever implements Retriever {
  async retrieve(query: string, topK = 3): Promise<RetrievalResult> {
    const snapshot = await readSnapshot();
    if (snapshot.chunks.length === 0) {
      return { chunks: [], topScore: 0 };
    }

    const queryEmbedding = await embedText(query);
    const scored = snapshot.chunks
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
