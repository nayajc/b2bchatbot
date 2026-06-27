import { promises as fs } from "fs";
import path from "path";
import type { KBChunk, KBItem } from "@/lib/types";

export interface KBSnapshot {
  generatedAt: string;
  usingFallbackEmbeddings: boolean;
  items: KBItem[];
  chunks: KBChunk[];
}

const SNAPSHOT_PATH = path.join(process.cwd(), ".data", "kb-snapshot.json");

/**
 * The Retriever interface (Architect #1) reads from this local snapshot for
 * the pilot's in-memory cosine implementation. `npm run ingest` writes it;
 * when Firebase env vars are configured, ingest also upserts the same rows
 * to kb_items/kb_chunks so the snapshot and Firestore stay in sync. Promoting
 * to a vector-index-backed Retriever later means swapping this file's
 * reader, not the interface.
 */
export async function writeSnapshot(snapshot: KBSnapshot): Promise<void> {
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
}

export async function readSnapshot(): Promise<KBSnapshot> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf-8");
    return JSON.parse(raw) as KBSnapshot;
  } catch {
    return { generatedAt: "", usingFallbackEmbeddings: true, items: [], chunks: [] };
  }
}
