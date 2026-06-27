/**
 * Async escalation transport: DB ticket row + staff email (Resend). No live
 * chat (P3 non-goal). Helpdesk-vs-DB-ticket integration is an open question
 * — this implementation is the DB-ticket + email pilot path.
 */
export interface EscalationNotification {
  conversationId: string;
  question: string;
  reason: string;
  escalationId: string | null;
}

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  // Vercel sets VERCEL_URL automatically (no protocol, deployment-specific) —
  // useful as a fallback so preview deploys still produce a working link
  // even without NEXT_PUBLIC_APP_URL configured.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function notifyStaff(notification: EscalationNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const staffEmail = process.env.ESCALATION_STAFF_EMAIL;
  const fromAddress = process.env.EMAIL_FROM;

  if (!apiKey || !staffEmail || !fromAddress) {
    console.warn(
      "[notify] RESEND_API_KEY/ESCALATION_STAFF_EMAIL/EMAIL_FROM not configured — skipping email send.",
      notification
    );
    return;
  }

  const replyLink = notification.escalationId
    ? `${getAppUrl()}/staff/escalations#${notification.escalationId}`
    : `${getAppUrl()}/staff/escalations`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `B2B FAQ Bot <${fromAddress}>`,
      to: [staffEmail],
      subject: `[Escalation] New question needs your reply — conversation ${notification.conversationId}`,
      text: `A travel agency asked a question our assistant could not answer confidently.\n\nQuestion: ${notification.question}\nReason: ${notification.reason}\nConversation: ${notification.conversationId}\n\nAnswer it here: ${replyLink}\n\nYour answer becomes a draft KB entry, so the same question gets auto-answered next time.`,
    }),
  });

  if (!res.ok) {
    console.error("[notify] Resend send failed:", res.status, await res.text());
  }
}
