export type KBItemStatus = "draft" | "published";

export interface KBItem {
  id: string;
  title: string;
  source_ref: string | null;
  raw_text: string;
  status: KBItemStatus;
  updated_at: string;
}

export interface KBChunk {
  id: string;
  kb_item_id: string;
  content: string;
  embedding: number[];
  citation_label: string;
  tokens: number;
}

export interface TravelAgency {
  id: string;
  name: string;
  contact_email: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
}

export interface Conversation {
  id: string;
  agency_id: string;
  channel: "widget";
  created_at: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export type AnswerRoute = "answered" | "escalated" | "human_routed";

export interface Answer {
  id: string;
  message_id: string;
  text: string;
  confidence: number;
  cited_chunk_ids: string[];
  route: AnswerRoute;
}

export type EscalationStatus = "open" | "assigned" | "closed";

export interface Escalation {
  id: string;
  conversation_id: string;
  reason: string;
  status: EscalationStatus;
  assigned_staff_id: string | null;
  resolved_answer_text: string | null;
  created_at: string;
}

export interface UnansweredLog {
  id: string;
  question: string;
  top_score: number;
  route: AnswerRoute;
  kb_item_id: string | null;
  created_at: string;
}
