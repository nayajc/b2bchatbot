# Plan: B2B Ticket-Resale FAQ Chatbot (English RAG)

> **Status: IMPLEMENTED (pilot scaffold)** — consensus-approved (Planner → Architect → Critic, Critic APPROVE), then built per user request "omc plan대로 구현해줘" on 2026-06-27. `npm run build` passes; AC8 grep check passes. Real `VOYAGE_API_KEY`/`ANTHROPIC_API_KEY`/Supabase credentials are still required to turn the Phase 2 eval gate green — see Implementation Notes below.
> RALPLAN-DR — SHORT mode. Greenfield at `/Users/jcsong/codework/b2b-chat-bot`.
> Source of truth: the approved deep-interview spec. This plan must not contradict it.

---

## 1. RALPLAN-DR Summary

### Principles (P)
1. **Cite-or-escalate.** Never answer without a source citation; if confidence/coverage is low, route to a human. Trust > coverage in a B2B reselling context.
2. **Pilot speed over platform.** Phase 1 is a 20–30 FAQ pilot at ~50% automation. Choose managed/low-ops services; avoid building infrastructure we can defer.
3. **No external system coupling (Phase 1).** Zero inventory/booking/ticketing API integration. RAG over static KB + async escalation only. This is a hard non-goal boundary.
4. **Observability is a feature, not an afterthought.** Unanswered/escalated/low-confidence questions must be logged structurally so the KB improves every week.
5. **Untrusted input by default.** Agency-typed messages are untrusted; treat every user turn as potential prompt injection and keep retrieval/citation grounded.

### Top 3 Decision Drivers (D)
1. **Time-to-pilot** — must ship a usable widget + 20–30 answerable FAQs fast, with a small team.
2. **Answer trustworthiness** — grounded, source-cited answers; safe escalation when uncertain (directly drives the 50% acceptance metric and B2B trust).
3. **Low ops / low cost at pilot scale** — minimal servers to run; pay-per-use; easy to hand to a non-infra team.

### Options (≥2, with bounded pros/cons)

**Option A — Managed-Postgres + pgvector + Next.js (RECOMMENDED)**
Stack: Next.js (App Router, TS) hosting both the embeddable widget and API routes on Vercel; Supabase (Postgres + pgvector) for KB chunks, embeddings, conversations, escalations, and unanswered logs; Anthropic Claude (latest Sonnet) for generation; Anthropic/Voyage embeddings for retrieval; Resend (or SMTP) for escalation email + DB-backed ticket rows; Supabase Auth (magic link / token) for portal access.
- Pros: One datastore for everything (vectors + relational + logs) → less glue; managed/low-ops; pgvector is plenty for 20–30 FAQs and scales to thousands; single-language TS stack; trivial widget embed; cheap at pilot scale.
- Cons: pgvector recall tuning is manual at larger scale (irrelevant for pilot); Supabase adds one vendor; cold-start on serverless functions (negligible for FAQ latency).

**Option B — Dedicated vector DB (Pinecone/Qdrant) + thin Node API**
Stack: Pinecone or Qdrant Cloud for vectors; a separate Postgres/SQLite for relational data; standalone Node/Fastify API; same Claude generation + widget.
- Pros: Best-in-class vector recall/filters; clean separation of concerns; scales hard later.
- Cons: Two+ datastores to operate and keep consistent (more ops, more glue code); overkill for 20–30 FAQs; slower to pilot; higher fixed cost. Violates Driver #1 and #3 for this phase.

**Recommendation: Option A.** It best satisfies all three drivers (speed, trust via grounded RAG, low ops). pgvector is more than sufficient at pilot scale; we keep the retrieval layer behind an interface so a future swap to Option B is a contained change if scale demands it.

---

## 2. Requirements Summary

| Area | Requirement (from spec) |
|---|---|
| Goal | Resell domestic admission tickets to English-speaking B2B travel agencies; auto-answer repetitive static FAQs (pricing/commission/settlement, product/usage) at ~50% automation. |
| Language | English only. |
| Channel | Embeddable widget inside our own web/portal. |
| Answering | RAG with source citations; if uncertain/uncovered → escalate. |
| Escalation | Async via email/ticket to staff (no live chat). |
| Routing | Real-time inventory/booking/issuance questions → route to human (do not attempt to answer). |
| KB | Source format undecided → must ingest messy sources into structured chunks. |
| Analytics | Log unanswered/escalated questions for KB improvement; measure response-time savings, latency, accuracy. |
| Entities | TravelAgency, Question, Answer, KBItem, Staff, Escalation, Conversation, Channel. |
| Non-goals (P1) | Real-time inventory lookup, booking/issuance txns, system API integration, live chat, non-English. |
| Pilot | 20–30 core FAQs; 50% automation rate. |

---

## 3. Phased Implementation Steps

### Phase 0 — Scaffold & contracts (foundation)
- **Files:** `package.json`, `next.config.ts`, `tsconfig.json`, `.env.example`, `lib/db.ts` (Supabase client), `lib/anthropic.ts` (Claude client), `lib/types.ts` (entity types).
- Init Next.js + TS + Tailwind. Add Supabase + Anthropic SDKs.
- Define DB schema (SQL migration `supabase/migrations/0001_init.sql`):
  - `kb_item` (id, title, source_ref, raw_text, status, updated_at)
  - `kb_chunk` (id, kb_item_id, content, embedding vector, citation_label, tokens)
  - `travel_agency`, `staff`
  - `conversation` (id, agency_id, channel, created_at)
  - `message` (id, conversation_id, role, content, created_at)
  - `answer` (id, message_id, text, confidence, cited_chunk_ids[])
  - `escalation` (id, conversation_id, reason, status, assigned_staff_id, resolved_answer_text, created_at)
  - `unanswered_log` (id, question, top_score, route, created_at)
  - **Return-path edge (Architect #4):** `kb_item.status ∈ {draft, published}` and `unanswered_log.kb_item_id` (nullable FK). When staff resolve an escalation, their answer + the originating `unanswered_log.question` create a `kb_item` with `status='draft'` for review → publish. This is the structural loop AC6 depends on.
- **Acceptance:** `npm run dev` boots; migrations apply; clients connect with env keys.

### Phase 1 — KB ingestion pipeline (messy → structured chunks)
- **Files:** `scripts/ingest.ts`, `lib/ingest/parse.ts`, `lib/ingest/chunk.ts`, `lib/ingest/embed.ts`, `kb/` (raw source drop folder), `kb/REVIEW.md`.
- Accept messy inputs (md/txt/csv/pasted FAQ). Normalize → split into Q/A or topic chunks → attach `citation_label` (human-readable source) → embed (Voyage/Anthropic embeddings) → upsert to `kb_chunk`.
- Curate the 20–30 pilot FAQs into structured `kb_item` rows (pricing/commission/settlement, product/usage).
- **Acceptance:** Running `npm run ingest` populates `kb_chunk` with embeddings + citation labels for the 20–30 pilot FAQs; a `kb/REVIEW.md` lists every ingested item for human sign-off.

### Phase 2 — RAG answer engine with cite-or-escalate (core) ⭐ pilot hypothesis lives here
- **Files:** `app/api/chat/route.ts`, `lib/rag/retriever.ts` (interface + impl), `lib/rag/answer.ts`, `lib/rag/security.ts`, `lib/rag/control-flow.ts`, `lib/rag/denylist.ts`.
- **Retriever interface (Architect #1):** define one contract — `retrieve(query: string) => { chunks: {id, content, citationLabel, score}[], topScore: number }`. Ship an **in-memory cosine** implementation over the 20–30 chunks first (zero vector-index dependency); pgvector becomes a drop-in implementation of the same interface only when chunk count actually warrants it. This is the seam, concretely specified.
- **Coverage-gating instead of an LLM router (Architect #2):** delete the standalone intent classifier. Real-time inventory/booking/issuance questions escalate naturally because a static KB returns `topScore` below threshold. Add a small **deterministic keyword denylist** (`denylist.ts`: "in stock", "available today", "book", "issue tickets", etc.) as a cheap pre-filter for the highest-risk over-answering case (AC4). Coverage-gating is the backstop for paraphrased evasions.
- `answer.ts`: call Claude (verify exact current model ID against the Claude API reference at build time — do not hardcode from memory) with retrieved chunks + strict system prompt: answer **only** from provided context, must include citations, must say "I'll connect you with our team" when context is insufficient.
- `security.ts` (security concern only): prompt-injection isolation — treat retrieved + user text as data, refuse instruction-override, never expose system prompt/credentials. Gets the dedicated `security-reviewer` lane.
- `control-flow.ts` (product logic): confidence/coverage gating (low `topScore`/empty retrieval → escalate) + write `unanswered_log`.
- **Similarity threshold = the central tuned parameter (Architect tension).** Cite-or-escalate (P1) vs the 50% target (AC2) conflict directly; the threshold is set **empirically via the eval set**, never guessed, and reported on the dashboard.
- **Phase 2 EXIT GATE (Architect #3):** `tests/eval/pilot-questions.json` (covered + out-of-scope + paraphrased inventory/booking + injection probes) must pass before any widget/escalation-UI/dashboard work: injection probes 100% refuse, AC1/AC3/AC4 hold, and automation rate on a **held-out slice** (not the KB-authoring set) meets target. No downstream phase starts until this gate is green.
- **Acceptance:** Covered FAQ → grounded English answer with ≥1 citation label; uncovered/uncertain → escalation response + `unanswered_log` row; inventory/booking query → human-routing response, never a fabricated answer; eval gate green.

### Phase 3 — Escalation (async email/ticket) + KB return-path
- **Files:** `app/api/escalate/route.ts`, `lib/escalation/notify.ts`, `app/staff/escalations/page.tsx` (minimal staff list view), `app/api/escalate/resolve/route.ts`.
- Create `escalation` row + send email to staff (Resend/SMTP) with conversation context. Ticket = DB row with status (open/assigned/closed).
- **Return-path (Architect #4):** when staff resolve, their answer + the originating `unanswered_log.question` create a `kb_item` with `status='draft'`; reviewer publishes it. This is what makes automation rate climb week over week — the loop the pilot is measured on. Enforce that drafts cite real, current chunks before publish (no stale citations).
- **Acceptance:** An escalation creates a DB row AND sends a staff email; staff page lists open escalations; resolving an escalation produces a `draft` `kb_item` linked to its `unanswered_log`.

### Phase 4 — Embeddable widget (auth behind a stub)
- **Files:** `app/widget/page.tsx` (chat UI), `public/embed.js` (loader snippet), `lib/auth/getAgencyContext.ts` (stub), `app/portal/page.tsx`.
- **Auth stub (Architect #6):** widget calls `getAgencyContext()` returning the agency identity; ship a stub so widget work is NOT blocked on the unresolved SSO-vs-Supabase-Auth decision (open question). Real auth is a single-function swap later — tracked as a follow-up, must not silently remain the pilot's auth.
- Widget renders chat, shows citations inline, shows "connect to team" CTA on escalation. `embed.js` lets the portal drop in the widget.
- **Acceptance:** A host page embedding `embed.js` shows a working chat; `getAgencyContext()` gates access (tested against the stub contract); citations render; escalation CTA works end-to-end.

### Phase 5 — Analytics & unanswered review loop (right-sized)
- **Files:** `supabase/migrations/0002_metrics_view.sql` (SQL view), `app/admin/metrics/page.tsx` (single page).
- **Right-sized (Architect #7):** a SQL view computing automation rate (answered-without-escalation / total) + avg latency, plus one page listing the metric and top unanswered clusters from `unanswered_log`. No multi-file aggregation service for the pilot.
- **Acceptance:** Page shows automation rate, latency, and a ranked list of unanswered questions feeding the KB return-path.

---

## 4. Testable Acceptance Criteria (mapped to spec)

| # | Spec requirement | Test |
|---|---|---|
| AC1 | English FAQ auto-answer + source citation | Ask a covered FAQ → response is English, contains ≥1 citation label tied to a real `kb_chunk`. |
| AC2 | ~50% automation | On a 20–30 question pilot set, ≥50% answered without escalation; measured on the metrics dashboard. |
| AC3 | Uncertain/uncovered → email/ticket escalation | Ask out-of-KB question → escalation row + staff email created; user gets handoff message. |
| AC4 | Real-time inventory/booking → human routing | Ask "is X in stock today / book me 5 tickets" → router returns human-routing, no fabricated answer. |
| AC5 | Widget embed | `embed.js` on an external host page renders a functioning authenticated chat. |
| AC6 | Unanswered logging → KB improvement | Every escalation/low-confidence turn writes `unanswered_log`; dashboard ranks gaps. |
| AC7 | Aux metrics | Dashboard reports latency + automation rate (response-time-savings proxy). |
| AC8 | No external system coupling | Codebase contains no inventory/booking/issuance API calls (grep + review). |

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **RAG hallucination** | Strict "answer only from provided context" system prompt; require citation in output; refuse + escalate when retrieval is empty/low-score; verify cited chunk IDs exist before returning (AC1). |
| **KB quality / messy sources** | Ingestion pipeline normalizes to structured chunks with `kb/REVIEW.md` human sign-off gate; curated 20–30 pilot set before launch. |
| **Low automation rate (<50%)** | `unanswered_log` + metrics dashboard create a weekly KB-improvement loop; cluster top misses and author new `kb_item`s; tune retrieval threshold. |
| **Prompt injection from agency input** | `guardrails.ts`: isolate user/retrieved text as data, ignore embedded instructions, never expose system prompt or credentials, never follow "ignore previous instructions"; route suspicious turns to human. |
| **Over-answering real-time questions** | Coverage-gating (static KB → low `topScore` → escalate) + deterministic keyword denylist for inventory/booking/issuance; coverage-gate is the backstop for paraphrased evasions (AC4). |
| **Vendor lock / scale** | Retrieval behind the `Retriever` interface; in-memory cosine first, pgvector as a drop-in impl, Option B (Pinecone/Qdrant) a contained swap later. |
| **Trust vs 50% automation conflict** | Similarity threshold tuned empirically on the eval set (held-out slice for honest measurement); reported on the dashboard, not guessed. |
| **PII / data retention** (Critic) | Add a retention policy for `message`/`conversation`/`unanswered_log` (don't store agency content indefinitely). Tracked follow-up. |
| **Abuse / cost on `/api/chat`** (Critic) | Add rate-limiting on the chat endpoint (cost + injection-probing surface). Phase 2 follow-up. |

---

## 6. Verification Steps
1. **Static/non-goal check:** grep the repo for inventory/booking/issuance API usage → must be empty (AC8).
2. **RAG eval set:** maintain `tests/eval/pilot-questions.json` (the 20–30 FAQs + 10 out-of-scope + 5 injection probes); run a script asserting AC1/AC3/AC4 and reporting automation rate for AC2.
3. **Escalation E2E:** trigger an uncovered question; confirm `escalation` row + email + staff list entry.
4. **Widget E2E:** load `embed.js` on a scratch host page (Playwright); auth, ask covered + uncovered questions, assert citation render and escalation CTA.
5. **Metrics check:** run the eval set, confirm dashboard automation rate matches computed value and unanswered clusters appear.
6. **Reviewer pass:** separate `code-reviewer` + `security-reviewer` lane on the guardrails/auth code before pilot sign-off.

---

## Open Questions (carry to interview / execution)
- KB source delivery format and ownership (who provides the messy FAQ docs, and in what form)?
- Escalation transport: existing helpdesk/ticket system to integrate vs. DB-ticket + email only for pilot?
- Auth model: SSO from existing portal vs. standalone Supabase Auth for the pilot?
- Embedding provider choice (Voyage vs. Anthropic) — confirm account/keys available.
- Definition of "accuracy" metric for aux KPI (human-rated sample vs. proxy)?

---

## 7. ADR — Architecture Decision Record

- **Decision:** Build the Phase-1 pilot as a single-stack Next.js (App Router, TS) app — embeddable widget + API on Vercel — over Supabase (Postgres for relational/auth/logs), with RAG done via a `Retriever` interface backed by **in-memory cosine** over the 20–30 pilot chunks (pgvector deferred as a drop-in impl). Claude (current model, verified at build) generates cite-or-escalate answers; escalation is async email + DB ticket with a draft-KB return-path.
- **Drivers:** time-to-pilot; answer trustworthiness (grounded + cited); low ops/cost at pilot scale.
- **Alternatives considered:** (B) dedicated vector DB (Pinecone/Qdrant) + separate relational store + standalone Node API — rejected: two+ datastores, more glue, overkill for 20–30 FAQs, slower to pilot (violates Drivers #1/#3). (A-as-originally-written) Supabase **pgvector** from day one — amended: pgvector is premature platform weight for 30 chunks; kept behind the interface, promoted only when chunk count warrants. LLM intent-classifier router — rejected: redundant second failure point; coverage-gating + keyword denylist is cheaper and deterministic.
- **Why chosen:** maximizes pilot speed and trust while removing the one piece of premature infrastructure; the `Retriever` seam makes the in-memory→pgvector→(Option B) path a contained change, proving the swap works before any vendor migration.
- **Consequences:** one vendor (Supabase) for relational/auth/logs; a second (smaller) retriever swap when KB grows past a few thousand chunks; the similarity threshold becomes the central tuned parameter, gated by the eval set.
- **Follow-ups:** real auth (replace `getAgencyContext()` stub); PII/retention policy; rate-limiting on `/api/chat`; helpdesk integration vs DB-ticket; embedding-provider + accuracy-metric decisions (open questions).

---

## 8. Consensus Changelog (improvements merged)

Applied from Architect + Critic review (Critic verdict: **APPROVE** with these as mandatory merges):
1. **Retriever interface specified** + in-memory cosine first, pgvector deferred (Architect #1).
2. **LLM router removed** → coverage-gating + deterministic keyword denylist (Architect #2).
3. **Eval set promoted to Phase 2 EXIT GATE** with held-out automation-rate slice (Architect #3).
4. **Escalation return-path** seam: staff answer → `draft` `kb_item` linked to `unanswered_log` (Architect #4).
5. **guardrails split** into `security.ts` (injection) vs `control-flow.ts` (gating/logging) (Architect #5).
6. **Auth deferred** behind `getAgencyContext()` stub (Architect #6).
7. **Phase 5 right-sized** to a SQL view + single page (Architect #7).
8. **Threshold tuning** elevated to the central design parameter, set empirically (Architect/Critic tension).
9. **Minor (Critic):** `*.page.ts` → `page.tsx`; verify exact Claude model ID at build; PII/retention + rate-limiting risks added; held-out eval slice to avoid overfit.

---

## 9. Implementation Notes (2026-06-27)

- `npm run build` and `npx tsc --noEmit` pass. AC8 grep check passes (no inventory/booking/ticketing API references in `app/`, `lib/`, `scripts/`).
- `npm run ingest` produced 24 `kb_chunk` rows (within the 20–30 pilot target) from sample placeholder FAQ markdown in `kb/raw/` — **replace with the real fact sheet content** before pilot launch (KB source format open question still applies).
- `npm run eval` (Phase 2 exit gate) currently reports **RED** in this environment because no `VOYAGE_API_KEY` or `ANTHROPIC_API_KEY` is configured:
  - AC4 (denylist) and AC3 (out-of-scope → escalate) **PASS** — these are deterministic/structural.
  - AC1/AC2 (covered-FAQ automation rate) **FAIL** under the fallback hash-embedding mode (`lib/ingest/embed.ts`) — this is expected and intentional: the fallback is explicitly documented as not semantically meaningful and must not be used to tune the threshold.
  - Injection probes are **SKIPPED** without a live `ANTHROPIC_API_KEY`.
  - **Action required before pilot launch:** set `VOYAGE_API_KEY` + `ANTHROPIC_API_KEY` + Firebase env vars, re-run `npm run ingest` then `npm run eval`, and tune `RAG_SIMILARITY_THRESHOLD` until the gate is green.
- Auth (`lib/auth/getAgencyContext.ts`), embedding provider (Voyage default), and helpdesk-vs-DB-ticket transport remain the tracked open questions/follow-ups from the ADR — all implemented behind the stubs/interfaces the plan specified so none of them block the rest of the pilot.

---

## 11. Threshold Empirical Tuning (2026-06-27, live data)

Ran `npm run ingest` + `npm run eval` with real `voyage-3.5` embeddings (24 sample FAQ chunks) and a live `ANTHROPIC_API_KEY` for the first time. Results at the original default `RAG_SIMILARITY_THRESHOLD=0.72`:

| Threshold | Automation rate (24-question held-out set) | Out-of-scope safety margin |
|---|---|---|
| 0.72 (prior default) | 20.8% (5/24) | 0.052 (max OOS score 0.668) |
| 0.68 | 45.8% (11/24) | 0.012 |
| 0.67 | 54.2% (13/24) — clears AC2 numerically | **0.002 — overfit risk on a 34-item probe set** |
| 0.65 | 75% | unsafe — the OOS probe "Can you set up a custom co-branded landing page" (0.668) crosses into auto-answer territory |

**Decision (user-confirmed, conservative option):** set `RAG_SIMILARITY_THRESHOLD=0.68`. AC3/AC4/injection probes all pass cleanly at every threshold tested; AC2 (50% automation) is **not yet met** (45.8%) — accepted as the correct Day-1 pilot state rather than chasing the numeric target into a 0.002 safety margin on a tiny eval set.

**Why this is acceptable, not a gap:** the borderline FAILs cluster just below 0.68 (e.g. "Can wholesale rates change without warning?" 0.523, "Is there a cancellation policy before redemption?" 0.555, several payment/refund phrasings 0.61–0.675) — this is exactly what the Architect #4 escalation return-path loop (Phase 3) exists to close: each of these escalates safely today, a staff reply creates a draft `kb_item`, and republishing tightens retrieval for that phrasing without ever lowering the safety margin against out-of-scope questions. Automation rate is expected to climb toward 50%+ over the first few weeks of real escalations, not via further threshold tuning on this static probe set.

**Follow-up:** once the real (non-placeholder) FAQ content replaces `kb/raw/*.md`, re-run this empirical tuning pass — chunk/citation quality on real content may shift the safe-threshold/automation-rate trade-off in either direction.

---

## 10. ADR Amendment — Supabase → Firebase (2026-06-27)

- **Decision:** Replace Supabase (Postgres) with **Firebase (Firestore + Admin SDK)** for relational-ish data (kb_items, kb_chunks, conversations, messages, answers, escalations, unanswered_logs), per explicit user request ("Supabase말고 firebase로 해줘"). No consensus re-run — this is a backend swap behind existing interfaces, not a principle/driver change.
- **What did NOT change:** the `Retriever` interface and in-memory cosine implementation (`lib/rag/retriever.ts`) — it already read from a local JSON snapshot (`lib/ingest/snapshot.ts`), independent of the relational backend. This is the seam the original ADR anticipated paying off: only `lib/firebase.ts` and the handful of call sites that did `db.from(...)` changed.
- **What changed:**
  - `lib/db.ts` (Supabase client) → `lib/firebase.ts` (Firebase Admin SDK, service-account credentials).
  - SQL migrations (`supabase/migrations/*.sql`) removed — Firestore is schemaless; collections (`kb_items`, `kb_chunks`, `travel_agencies`, `staff`, `conversations`, `messages`, `answers`, `escalations`, `unanswered_logs`) are created implicitly on first write.
  - Phase 5's SQL view (`pilot_metrics`) replaced by `lib/metrics.ts`, a code-side aggregation reading `answers`/`unanswered_logs` directly — same scope (one aggregation surface + one page), Architect #7's "right-sized" intent preserved.
  - Added `firestore.rules` (default-deny; all access is server-side via Admin SDK, which bypasses rules) and `firestore.indexes.json` (composite index for the staff escalations query).
  - **Gap fixed during the swap:** the original Supabase build never actually wrote to `conversation`/`message`/`answer` despite the metrics view depending on them. Added `lib/conversation.ts` (`recordTurn`) called from `/api/chat`, and wired the widget to track `conversationId` and call `/api/escalate` on escalated/human-routed turns — closing the loop the metrics page needs to show real numbers.
- **Consequences:** no SQL/migration tooling; Firestore's lack of joins means the staff/metrics pages do client-side aggregation instead of SQL views, fine at pilot volume (tens–hundreds of docs) — revisit with `count()` aggregation queries or BigQuery export if volume grows materially. Firebase service-account credentials (`FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`) replace Supabase's URL/service-role-key pair in `.env.example`.
- **Verification:** `npx tsc --noEmit` clean, `npm run build` passes (same 12 routes), `npm run ingest` re-produces 24 chunks, AC8 grep check still passes.
