"use client";

import { useState } from "react";

export interface EscalationItemData {
  id: string;
  question: string;
  reason: string;
  status: string;
  created_at: string;
  conversation_id: string;
}

export default function EscalationItem({ escalation }: { escalation: EscalationItemData }) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/escalate/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalationId: escalation.id, staffAnswer: answer.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to submit answer");
      }
      setResolved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (resolved) {
    return (
      <li id={escalation.id} className="py-4">
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          Answered. A draft KB item was created from your reply — review and publish it, then
          re-run <code>npm run ingest</code> (or your publish step) so the assistant uses it.
        </div>
      </li>
    );
  }

  return (
    <li id={escalation.id} className="py-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{escalation.question}</span>
        <span className="text-xs uppercase tracking-wide text-gray-500">{escalation.status}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {escalation.reason} · Conversation {escalation.conversation_id} ·{" "}
        {new Date(escalation.created_at).toLocaleString()}
      </div>
      <textarea
        className="mt-3 w-full border rounded px-3 py-2 text-sm"
        rows={3}
        placeholder="Type your answer to the travel agency's question…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <button
        className="mt-2 bg-blue-600 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
        onClick={submit}
        disabled={submitting || !answer.trim()}
      >
        {submitting ? "Submitting…" : "Submit answer"}
      </button>
    </li>
  );
}
