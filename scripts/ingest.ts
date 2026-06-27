import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { parseMarkdownFaq } from "@/lib/ingest/parse";
import { chunkParsedSource } from "@/lib/ingest/chunk";
import { embedText, isUsingFallbackEmbeddings } from "@/lib/ingest/embed";
import { writeSnapshot } from "@/lib/ingest/snapshot";
import { upsertToFirestoreIfConfigured } from "@/lib/ingest/upsert";
import type { KBChunk, KBItem } from "@/lib/types";

const RAW_DIR = path.join(process.cwd(), "kb", "raw");

async function main() {
  const files = (await fs.readdir(RAW_DIR)).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    throw new Error(`No .md sources found in ${RAW_DIR}`);
  }

  const items: KBItem[] = [];
  const chunks: KBChunk[] = [];
  const reviewLines: string[] = [
    "# KB Ingestion Review",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Embedding mode: ${isUsingFallbackEmbeddings() ? "FALLBACK (no VOYAGE_API_KEY — not semantically meaningful, dev/test only)" : "voyage-3.5 (live)"}`,
    "",
    "Sign off on every item below before publishing to the pilot KB.",
    "",
  ];

  for (const file of files) {
    const raw = await fs.readFile(path.join(RAW_DIR, file), "utf-8");
    const parsed = parseMarkdownFaq(raw, file);
    const itemId = randomUUID();
    items.push({
      id: itemId,
      title: parsed.title,
      source_ref: parsed.sourceRef,
      raw_text: raw,
      status: "published",
      updated_at: new Date().toISOString(),
    });

    reviewLines.push(`## ${parsed.title} (${file})`, "");

    const ingestChunks = chunkParsedSource(parsed);
    for (const c of ingestChunks) {
      const embedding = await embedText(c.content);
      chunks.push({
        id: randomUUID(),
        kb_item_id: itemId,
        content: c.content,
        embedding,
        citation_label: c.citationLabel,
        tokens: Math.ceil(c.content.length / 4),
      });
      reviewLines.push(`- [ ] ${c.citationLabel}`);
    }
    reviewLines.push("");
  }

  await writeSnapshot({
    generatedAt: new Date().toISOString(),
    usingFallbackEmbeddings: isUsingFallbackEmbeddings(),
    items,
    chunks,
  });

  const upserted = await upsertToFirestoreIfConfigured(items, chunks);

  await fs.writeFile(path.join(process.cwd(), "kb", "REVIEW.md"), reviewLines.join("\n"), "utf-8");

  console.log(`Ingested ${items.length} kb_item(s), ${chunks.length} kb_chunk(s).`);
  console.log(`Firestore upsert: ${upserted ? "done" : "skipped (no Firebase env vars — snapshot-only)"}`);
  console.log(`Embeddings: ${isUsingFallbackEmbeddings() ? "FALLBACK (set VOYAGE_API_KEY for real embeddings)" : "voyage-3.5"}`);
  console.log(`Review file: kb/REVIEW.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
