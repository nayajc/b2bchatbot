import Anthropic from "@anthropic-ai/sdk";

// Verified current model id (see Claude API reference) — do not hardcode stale ids.
export const ANSWER_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing required env var: ANTHROPIC_API_KEY");
    client = new Anthropic({ apiKey });
  }
  return client;
}
