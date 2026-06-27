/**
 * Deterministic pre-filter for real-time inventory/booking/issuance
 * questions (AC4, non-goal P1/P3). Replaces a standalone LLM intent
 * classifier (Architect #2) — coverage-gating in control-flow.ts is the
 * backstop for phrasings that slip past these keywords.
 */
const DENYLIST_PATTERNS: RegExp[] = [
  // English
  /\bin stock\b/i,
  /\bavailable (today|tomorrow|this week|right now)\b/i,
  /\bavailability\b/i,
  /\bbook(ing)?\s+(me|us|for|\d)/i,
  /\bissue (a |the )?ticket/i,
  /\breserve\b/i,
  /\bhow many (tickets|seats|slots) (are |is )?left/i,
  /\bcan i (get|grab|buy) \d+/i,
  /\bsold out\b/i,
  // Vietnamese — same real-time inventory/booking/issuance intent (AC4
  // parity for the language toggle; not an exhaustive translation).
  /\bcòn (hàng|vé|chỗ)\b/i,
  /\bcòn trống\b/i,
  /\b(đặt|đặt chỗ|đặt vé)\b/i,
  /\bxuất vé\b/i,
  /\bhết vé\b/i,
  /\bcó sẵn (hôm nay|ngày mai|tuần này)\b/i,
];

export function matchesRealtimeDenylist(question: string): boolean {
  return DENYLIST_PATTERNS.some((pattern) => pattern.test(question));
}
