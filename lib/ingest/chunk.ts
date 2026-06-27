import type { ParsedSource } from "./parse";

export interface IngestChunk {
  kbItemTitle: string;
  sourceRef: string;
  content: string;
  citationLabel: string;
}

/**
 * One chunk per Q/A pair. At pilot scale (20-30 FAQs) a Q/A pair is the
 * right retrieval granularity — no further splitting needed.
 */
export function chunkParsedSource(parsed: ParsedSource): IngestChunk[] {
  return parsed.qas.map((qa) => ({
    kbItemTitle: qa.question,
    sourceRef: parsed.sourceRef,
    content: `Q: ${qa.question}\nA: ${qa.answer}`,
    citationLabel: `${parsed.title} — "${qa.question}"`,
  }));
}
