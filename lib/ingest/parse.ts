export interface ParsedQA {
  question: string;
  answer: string;
}

export interface ParsedSource {
  title: string;
  sourceRef: string;
  qas: ParsedQA[];
}

/**
 * Parses the pilot's "messy" markdown FAQ format: an H1 title followed by
 * repeated `Q: ...` / `A: ...` lines. Source format is an open question —
 * this parser covers the markdown shape; CSV/plain-text variants can be
 * added as additional parse functions behind the same ParsedSource contract.
 */
export function parseMarkdownFaq(raw: string, sourceRef: string): ParsedSource {
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : sourceRef;

  const qas: ParsedQA[] = [];
  const lines = raw.split("\n");
  let currentQ: string | null = null;
  let currentA: string[] = [];

  const flush = () => {
    if (currentQ && currentA.length > 0) {
      qas.push({ question: currentQ.trim(), answer: currentA.join(" ").trim() });
    }
    currentQ = null;
    currentA = [];
  };

  for (const line of lines) {
    const qMatch = line.match(/^Q:\s*(.+)$/);
    const aMatch = line.match(/^A:\s*(.+)$/);
    if (qMatch) {
      flush();
      currentQ = qMatch[1];
    } else if (aMatch && currentQ) {
      currentA.push(aMatch[1]);
    } else if (currentQ && line.trim() && !line.trim().startsWith("<!--")) {
      currentA.push(line.trim());
    }
  }
  flush();

  return { title, sourceRef, qas };
}
