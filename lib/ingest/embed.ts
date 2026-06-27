const VOYAGE_EMBED_MODEL = "voyage-3.5";
const FALLBACK_DIM = 256;

/**
 * Embeds text for retrieval. Provider choice (Voyage vs Anthropic) is an
 * open question in the plan — Voyage is the default since Anthropic does
 * not offer a first-party embeddings endpoint. When no VOYAGE_API_KEY is
 * configured (e.g. local dev without live credentials), falls back to a
 * deterministic hashing embedding so the ingestion/retrieval pipeline is
 * still exercisable end-to-end. The fallback is NOT semantically meaningful
 * and must not be used for the pilot eval gate — it exists only so the
 * Retriever interface and control flow can be tested without network access.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (apiKey) {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: text, model: VOYAGE_EMBED_MODEL }),
    });
    if (!res.ok) {
      throw new Error(`Voyage embedding request failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.data[0].embedding as number[];
  }

  return fallbackHashEmbedding(text);
}

function fallbackHashEmbedding(text: string): number[] {
  const vec = new Array(FALLBACK_DIM).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    vec[hash % FALLBACK_DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function isUsingFallbackEmbeddings(): boolean {
  return !process.env.VOYAGE_API_KEY;
}
