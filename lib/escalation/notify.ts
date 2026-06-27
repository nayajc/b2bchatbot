/**
 * Async escalation transport: DB ticket row + staff email (Resend). No live
 * chat (P3 non-goal). Helpdesk-vs-DB-ticket integration is an open question
 * — this implementation is the DB-ticket + email pilot path.
 */
export interface EscalationNotification {
  conversationId: string;
  question: string;
  reason: string;
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
      text: `A travel agency asked a question our assistant could not answer confidently.\n\nQuestion: ${notification.question}\nReason: ${notification.reason}\nConversation: ${notification.conversationId}\n\nReply via the staff escalations page to also draft a KB entry from your answer.`,
    }),
  });

  if (!res.ok) {
    console.error("[notify] Resend send failed:", res.status, await res.text());
  }
}
