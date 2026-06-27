"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LANGUAGES, UI_STRINGS, type Language } from "@/lib/i18n";

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  route?: "answered" | "escalated" | "human_routed";
  citations?: string[];
}

interface AgencyContext {
  agencyId: string;
  agencyName: string;
  authenticated: boolean;
}

export default function WidgetChat() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [agency, setAgency] = useState<AgencyContext | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const t = UI_STRINGS[language];

  useEffect(() => {
    fetch(`/api/auth/context?token=${encodeURIComponent(token ?? "")}`)
      .then((res) => res.json())
      .then(setAgency)
      .catch(() => setAgency({ agencyId: "", agencyName: "", authenticated: false }));
  }, [token]);

  if (!agency) {
    return <main className="p-8 text-sm text-gray-500">{t.loading}</main>;
  }

  if (!agency.authenticated) {
    return <main className="p-8 text-sm text-red-600">{t.notAuthenticated}</main>;
  }

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setTurns((turnsSoFar) => [...turnsSoFar, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversationId, language }),
      });
      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);
      setTurns((turnsSoFar) => [
        ...turnsSoFar,
        {
          role: "assistant",
          text: data.answer ?? t.errorMessage,
          route: data.route,
          citations: data.citations,
        },
      ]);

      if (data.conversationId && (data.route === "escalated" || data.route === "human_routed")) {
        fetch("/api/escalate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: data.conversationId,
            question,
            reason: data.route === "human_routed" ? "Real-time inventory/booking question" : "Low KB coverage",
            unansweredLogId: data.unansweredLogId,
          }),
        }).catch(() => {
          /* best-effort — staff page + unanswered_logs still surface the gap */
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-4 flex flex-col h-screen">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">
          {t.title} — {agency.agencyName}
        </h1>
        <div className="flex border rounded overflow-hidden text-xs shrink-0">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={
                "px-2 py-1 font-medium " +
                (language === lang.code ? "bg-blue-600 text-white" : "bg-white text-gray-600")
              }
              aria-pressed={language === lang.code}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto border rounded p-3 space-y-3 bg-gray-50">
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block px-3 py-2 rounded-lg max-w-[85%] text-sm " +
                (turn.role === "user" ? "bg-blue-600 text-white" : "bg-white border")
              }
            >
              {turn.text}
              {turn.citations && turn.citations.length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {t.sourceLabel}: {turn.citations.join("; ")}
                </div>
              )}
              {turn.route === "escalated" || turn.route === "human_routed" ? (
                <div className="mt-1 text-xs font-medium text-amber-700">{t.connectingToTeam}</div>
              ) : null}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-500">{t.thinking}</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm"
          placeholder={t.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
          onClick={send}
          disabled={loading}
        >
          {t.send}
        </button>
      </div>
    </main>
  );
}
