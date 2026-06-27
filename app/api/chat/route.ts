import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/rag/answer";
import { recordTurn } from "@/lib/conversation";
import type { Language } from "@/lib/i18n";

function parseLanguage(value: unknown): Language {
  return value === "vi" ? "vi" : "en";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  const language = parseLanguage(body?.language);

  if (!question) {
    return NextResponse.json({ error: "Missing 'question' string in request body" }, { status: 400 });
  }

  try {
    const result = await answerQuestion(question, language);
    const newConversationId = await recordTurn(conversationId, question, result);
    return NextResponse.json({
      answer: result.text,
      route: result.route,
      citations: result.citedChunks.map((c) => c.citationLabel),
      topScore: result.topScore,
      threshold: result.threshold,
      conversationId: newConversationId,
    });
  } catch (err) {
    console.error("[api/chat] failed:", err);
    return NextResponse.json({ error: "Internal error answering the question" }, { status: 500 });
  }
}
