import { ANSWER_MODEL, getAnthropic } from "@/lib/anthropic";
import { buildUserTurn, getSystemPrompt } from "./security";
import { decideRoute, getSimilarityThreshold, logUnanswered } from "./control-flow";
import { getRetriever, type RetrievedChunk } from "./retriever";
import type { AnswerRoute } from "@/lib/types";
import type { Language } from "@/lib/i18n";

export interface ChatAnswer {
  text: string;
  route: AnswerRoute;
  citedChunks: RetrievedChunk[];
  topScore: number;
  threshold: number;
  unansweredLogId: string | null;
}

const ESCALATION_MESSAGE: Record<Language, string> = {
  en: "I don't have enough information in our knowledge base to answer that confidently. I'll connect you with our team, who will follow up by email shortly.",
  vi: "Tôi chưa có đủ thông tin trong cơ sở dữ liệu để trả lời chắc chắn câu hỏi này. Tôi sẽ kết nối bạn với đội ngũ của chúng tôi, họ sẽ phản hồi qua email trong thời gian ngắn.",
};

const HUMAN_ROUTED_MESSAGE: Record<Language, string> = {
  en: "That question involves real-time inventory or booking, which I can't check directly. I'll connect you with our team so they can confirm and assist.",
  vi: "Câu hỏi này liên quan đến tình trạng tồn kho hoặc đặt vé theo thời gian thực, tôi không thể kiểm tra trực tiếp. Tôi sẽ kết nối bạn với đội ngũ của chúng tôi để xác nhận và hỗ trợ.",
};

/**
 * Orchestrates retrieve -> route -> (generate | escalate) per the
 * cite-or-escalate principle. This is the function app/api/chat/route.ts
 * calls; it owns no I/O concerns beyond what retriever/security/control-flow
 * already expose, keeping the Phase 2 eval gate testable in isolation.
 *
 * `language` controls the response language only — retrieval still runs
 * against the English KB and routing/denylist decisions are language-aware
 * (see lib/rag/denylist.ts) but independent of this parameter.
 *
 * KNOWN LIMITATION: retrieval embeds the question text as-is. A Vietnamese
 * question against English-only kb_chunks is a cross-lingual similarity
 * comparison, which scores measurably lower than same-language matches even
 * with a multilingual embedding model (observed: a Vietnamese paraphrase of
 * an English-answered FAQ fell from topScore ~0.71 to below the 0.68
 * threshold and escalated). This under-counts Vietnamese automation rate
 * until the KB itself has Vietnamese-authored or Vietnamese-translated
 * chunks (or a language-specific threshold is empirically tuned) — re-run
 * `npm run eval` with Vietnamese probes once real KB content exists.
 */
export async function answerQuestion(question: string, language: Language = "en"): Promise<ChatAnswer> {
  const retriever = getRetriever();
  const retrieval = await retriever.retrieve(question);
  const decision = decideRoute(question, retrieval);
  const threshold = getSimilarityThreshold();

  const unansweredLogId = await logUnanswered(question, retrieval.topScore, decision.route);

  if (decision.route === "human_routed") {
    return {
      text: HUMAN_ROUTED_MESSAGE[language],
      route: "human_routed",
      citedChunks: [],
      topScore: retrieval.topScore,
      threshold,
      unansweredLogId,
    };
  }

  if (decision.route === "escalated") {
    return {
      text: ESCALATION_MESSAGE[language],
      route: "escalated",
      citedChunks: [],
      topScore: retrieval.topScore,
      threshold,
      unansweredLogId,
    };
  }

  const context = retrieval.chunks
    .map((c) => `[${c.citationLabel}]\n${c.content}`)
    .join("\n\n");

  const response = await getAnthropic().messages.create({
    model: ANSWER_MODEL,
    max_tokens: 500,
    system: getSystemPrompt(language),
    messages: [{ role: "user", content: buildUserTurn(question, context) }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return {
    text,
    route: "answered",
    citedChunks: retrieval.chunks,
    topScore: retrieval.topScore,
    threshold,
    unansweredLogId,
  };
}
