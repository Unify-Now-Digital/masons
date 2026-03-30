# AI-generated conversation summary (Inbox middle pane)

## Overview

Add a **persisted, server-generated** one-paragraph **conversation summary** in the **header region** of the Inbox **middle column**, for both **Conversations** mode (single channel thread) and **Customers** mode (unified cross-channel timeline). Summary is **automatic** on thread selection and **refreshes when messages change** (no manual regenerate, no refresh button). Reuse the **same architectural pattern** as the existing AI reply suggestion: **Supabase Edge Function** + **service role** + **OpenAI** + **DB cache** + **React Query** + optional **`x-internal-key`** / JWT auth.

**Stack:** React + TypeScript (Vite), Tailwind, shadcn/ui, TanStack Query, Supabase (Postgres, RLS, Edge Functions).

**Non-goals:** Rewriting inbox architecture, changing provider-native `inbox_conversations` / `inbox_messages` shapes, session replay, streaming UI, user-editable summary text in v1.

---

## Current architecture (findings)

### Middle pane layout

| Layer | File | Role |
|--------|------|------|
| Page shell | `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Grid/layout, mode switch (Conversations / Customers), central column hosts view components. |
| Conversations body | `src/modules/inbox/components/ConversationView.tsx` | `ConversationHeader` (identity, link, subject) **then** `ConversationThread` (scrollable messages + composer). |
| Customers body | `src/modules/inbox/components/CustomerConversationView.tsx` | Same: `ConversationHeader` then `ConversationThread` with `conversationIdByChannel` / unified props. |
| Header UI | `src/modules/inbox/components/ConversationHeader.tsx` | Sticky bar: `displayName`, `handleLine`, optional `subjectLine`, link badge, optional link action. **No summary today.** |
| Thread + composer | `src/modules/inbox/components/ConversationThread.tsx` | Message list in scroll container; **bottom** composer; **`useSuggestedReply(lastInboundMessage?.id)`** for chip above Send. |

**Placement (requirement 10):** Insert summary **below** `ConversationHeader` and **above** the scrollable message timeline (`ConversationThread`’s inner scroll area). Implementing inside `ConversationThread` *above* the scroll `div` would couple summary to thread internals; **cleaner:** a small wrapper or a **new sibling block** between header and `<ConversationThread>` in **both** `ConversationView.tsx` and `CustomerConversationView.tsx`, **or** an optional prop on `ConversationThread` rendering a `shrink-0` summary strip **above** `ref={scrollContainerRef}` (keeps one component touch point). Spec recommends **shared component** + **one callsite pattern** in both parent views to avoid duplicate layout rules.

### Existing AI reply pipeline (reuse patterns)

| Piece | Location |
|-------|----------|
| Edge Function | `supabase/functions/inbox-ai-suggest-reply/index.ts` |
| Cache table | `public.inbox_ai_suggestions` (`supabase/migrations/20260206120000_create_inbox_ai_suggestions.sql`) — unique `message_id`, RLS SELECT via `exists (select 1 from inbox_messages m where m.id = …)`, inserts **only** from Edge Function (service role). |
| Client hook | `src/modules/inbox/hooks/useSuggestedReply.ts` — `useQuery`, key `['inbox', 'ai-suggest', messageId]`, `supabase.functions.invoke('inbox-ai-suggest-reply', { body: { message_id } })`, optional `VITE_INTERNAL_FUNCTION_KEY` → `x-internal-key`. |
| UI | `ConversationThread.tsx` — `SuggestedReplyChip` above composer. |

**Reuse for summaries:** Same **auth model** (Bearer JWT + optional `INTERNAL_FUNCTION_KEY` / `x-internal-key`), same **OpenAI** env (`OPENAI_API_KEY`), same **`stripHtml`** approach for email bodies, **JSON** structured output for one field (e.g. `summary`), **service role** client for reads/writes after auth gate.

### Message model

- `InboxMessage` in `src/modules/inbox/types/inbox.types.ts`: `id`, `conversation_id`, `channel`, `direction`, `body_text`, `subject`, `sent_at`, `created_at`, `updated_at`, etc.
- Conversations mode: `useMessagesByConversation(conversationId)` in `src/modules/inbox/hooks/useInboxMessages.ts`.
- Customers mode: `useCustomerMessages(personId)` — unified chronological list (projection); still backed by real `inbox_messages` rows.

### Inbox invalidation (refresh when messages change)

- `UnifiedInboxPage.tsx` already calls `queryClient.invalidateQueries({ queryKey: inboxKeys.all })` on realtime/polling paths (see existing `inboxKeys` in `src/modules/inbox/hooks/useInboxConversations.ts`).
- **Extension:** Also invalidate **`['inbox', 'ai-thread-summary']`** (or a defined prefix) whenever inbox messages/conversations are invalidated so the summary refetches and the Edge Function can **recompute staleness** vs DB fingerprint.

---

## Functional requirements (mapped)

| # | Requirement | Design implication |
|---|-------------|-------------------|
| 1 | Both Conversations and Customers modes | Two **scopes** in API + cache: `conversation` vs `customer_timeline`. |
| 2 | Auto on select/open | `useQuery` **enabled** when `conversationId` or `personId` is set; fetch on mount. |
| 3 | Persisted in DB | New cache table (see below). |
| 4 | Refresh when messages change | **Server-side fingerprint** on message set; **client** invalidates summary queries with inbox invalidation; Edge returns cached summary if fingerprint still matches, else regenerates. |
| 5 | One short paragraph | System prompt + `response_format: json_object` with key `summary`. |
| 6–7 | No refresh / no manual regenerate | No UI controls; rely on invalidation + refetch. |
| 8 | All messages in thread/timeline | Edge loads full ordered set for scope (see queries below). |
| 9 | Email, SMS, WhatsApp | Include `channel` + direction in prompt context; strip HTML for email like suggest-reply. |
| 10 | Header area placement | Below `ConversationHeader`, above scrollable messages. |
| 11 | Reuse AI pipeline | New function **alongside** `inbox-ai-suggest-reply`, not a rewrite of it. |

---

## Database design

### Recommendation: **new table** (do not overload `inbox_conversations` or `inbox_ai_suggestions`)

- **`inbox_ai_suggestions`** is **per message**; summaries are **per thread** or **per customer timeline** — different cardinality and invalidation rules.
- **`inbox_conversations`** holds one row per provider thread; **customer timeline** spans **multiple** conversations → no single FK for Customers mode.

### Table: `public.inbox_ai_thread_summaries`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `scope` | text | `'conversation'` \| `'customer_timeline'` |
| `conversation_id` | uuid NULL | FK → `inbox_conversations(id)` **ON DELETE CASCADE** |
| `person_id` | uuid NULL | FK → `public.customers(id)` **ON DELETE CASCADE** (aligns with `inbox_conversations.person_id` / `order_people`) |
| `summary_text` | text NOT NULL | One paragraph |
| `messages_fingerprint` | text NOT NULL | Opaque string; see below |
| `updated_at` | timestamptz | default `now()`, updated on regenerate |

**Constraints:**

- `CHECK (scope = 'conversation' AND conversation_id IS NOT NULL AND person_id IS NULL OR scope = 'customer_timeline' AND person_id IS NOT NULL AND conversation_id IS NULL)`
- **Partial unique indexes:**  
  - `UNIQUE (conversation_id) WHERE scope = 'conversation'`  
  - `UNIQUE (person_id) WHERE scope = 'customer_timeline'`

**`messages_fingerprint` (staleness):**

- Edge loads authoritative messages from DB for the scope:
  - **Conversation:** `SELECT id, updated_at FROM inbox_messages WHERE conversation_id = $id ORDER BY sent_at ASC, id ASC` (add `sent_at` in concatenation if needed for ordering consistency).
  - **Customer timeline:** all messages whose `conversation_id` is in `SELECT id FROM inbox_conversations WHERE person_id = $personId` (and **same user scoping** as existing inbox queries — mirror `user_id` / connection filters used elsewhere so multi-tenant safety matches app queries).
- Compute e.g. **`sha256` hex** of concatenated `id:updated_at` (or `id:updated_at:sent_at`) for every row in order.
- If stored `messages_fingerprint` equals computed fingerprint → return cached `summary_text` without calling OpenAI.
- Else → build transcript, call OpenAI, **upsert** row (update `summary_text`, `messages_fingerprint`, `updated_at`).

**RLS:** Enable RLS; **SELECT** for `authenticated` using `exists` subqueries analogous to `inbox_ai_suggestions`:

- **Conversation scope:** user can read row if they can read the parent conversation (join `inbox_conversations` with same predicates as existing inbox conversation policies).
- **Customer scope:** user can read row if they can read that `person_id` / customer in line with existing customer + inbox linkage policies.

**INSERT/UPDATE/DELETE:** No direct client writes; **Edge Function only** via service role (same as suggestions).

**Migration file:** `supabase/migrations/YYYYMMDDHHMMSS_create_inbox_ai_thread_summaries.sql` (follow `create-migration` / postgres style guide).

---

## Edge Function: `inbox-ai-thread-summary` (new)

**Path:** `supabase/functions/inbox-ai-thread-summary/index.ts`

**Request body (JSON):** one of:

- `{ "scope": "conversation", "conversation_id": "<uuid>" }`
- `{ "scope": "customer_timeline", "person_id": "<uuid>" }`

**Auth:** Copy pattern from `inbox-ai-suggest-reply`: JWT `getUser` **or** `x-internal-key` === `INTERNAL_FUNCTION_KEY`.

**Steps:**

1. Validate UUIDs and scope.
2. Load messages for scope (service role) with fields needed for summary: `channel`, `direction`, `sent_at`, `body_text`, `subject` (for email), `from_handle` / `to_handle` as needed; **order chronologically**.
3. If **zero messages** → return `{ "summary": null }` (or empty string) **without** OpenAI; optionally **delete** or skip cache row.
4. Compute **fingerprint**; read `inbox_ai_thread_summaries` for this `conversation_id` or `person_id`.
5. If fingerprint matches → `200 { "summary": summary_text }`.
6. If `OPENAI_API_KEY` missing → `500` with safe error (mirror suggest-reply).
7. Build **prompt**: memorial masonry context, neutral tone, **single short paragraph**, JSON `{ "summary": "..." }`. Include per-message lines like `[email|sms|whatsapp] [inbound|outbound] <timestamp>: <text>` with HTML stripped for email bodies (reuse `stripHtml` from suggest-reply or `_shared`).
8. Call OpenAI (same model family as suggest-reply, e.g. `gpt-4o-mini`) with `response_format: { type: 'json_object' }`.
9. Parse `summary`; validate non-empty string.
10. **Upsert** cache row with new `summary_text` and `messages_fingerprint`.

**CORS / headers:** Match `inbox-ai-suggest-reply` for `OPTIONS` and allow `x-internal-key`.

**Config:** Register function in deployment process (project may use implicit discovery; document deploy step).

---

## Frontend design

### Hook: `useThreadSummary` (new)

**File:** `src/modules/inbox/hooks/useThreadSummary.ts`

- **Inputs:** `{ scope: 'conversation'; conversationId: string | null } | { scope: 'customer_timeline'; personId: string | null }`
- **`useQuery`:**
  - `queryKey`: e.g. `['inbox', 'ai-thread-summary', scope, conversationId ?? personId]`
  - `enabled`: id present
  - `queryFn`: `supabase.functions.invoke('inbox-ai-thread-summary', { body: … })` with same internal key header pattern as `useSuggestedReply.ts`
- Returns `{ summary: string | null, isLoading, error }`

### Invalidation

**Files:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`, `src/modules/inbox/hooks/useInboxConversations.ts` (mutations), `src/modules/inbox/hooks/useInboxMessages.ts` (send success paths), and any other central `invalidateQueries({ queryKey: inboxKeys.all })` — add:

`queryClient.invalidateQueries({ queryKey: ['inbox', 'ai-thread-summary'] })`

(or invalidate `['inbox']` if you adopt a single subtree — **prefer explicit** `ai-thread-summary` prefix to avoid over-invalidating unrelated keys).

### UI component: `ConversationSummaryBanner` (new, suggested name)

**File:** `src/modules/inbox/components/ConversationSummaryBanner.tsx`

- Props: `summary`, `isLoading`, `error` (and optional `className`).
- **Loading:** one line muted text, e.g. “Summarising conversation…” (matches suggest chip tone `text-[11px] text-slate-500`).
- **Error:** quiet “Couldn’t load summary” (no retry button per requirements).
- **Empty / null:** render nothing (or hide strip).
- **Success:** single paragraph, `text-sm text-slate-600`, max width, border-b or subtle bg to separate from thread — **below** header identity block.

### Integration points

| File | Change |
|------|--------|
| `ConversationView.tsx` | After `ConversationHeader`, render `ConversationSummaryBanner` fed by `useThreadSummary({ scope: 'conversation', conversationId })`. |
| `CustomerConversationView.tsx` | Same with `scope: 'customer_timeline', personId`. |
| `useInboxConversations.ts` / `useInboxMessages.ts` / `UnifiedInboxPage.tsx` | Invalidate `['inbox', 'ai-thread-summary']` wherever `inboxKeys.all` (or messages) invalidation runs after sends/realtime/sync. |

**Do not** remove or relocate `useSuggestedReply` / `SuggestedReplyChip` in `ConversationThread.tsx` unless layout review demands it; summary is **independent** and **above** the thread scroll.

---

## Security & privacy

- No OpenAI key in client.
- Transcripts built **server-side** only; minimize PII in logs (do not log full bodies in production).
- Align with AGENTS.md: AI assistive; summary is **read-only** context for staff — no auto-actions.
- RLS must prevent cross-tenant reads of summary rows.

---

## Edge cases

| Case | Behaviour |
|------|-----------|
| Empty thread / timeline | No OpenAI call; UI shows no summary (or neutral empty). |
| Very long threads | Truncate prompt input to max tokens (document constant, e.g. last N messages or char budget) **with stable ordering**; still fingerprint **full** message set so edits outside window still invalidate — *spec recommends fingerprint on **all** message ids+timestamps, truncate only **prompt content**.* |
| Multiple products same price | N/A here. |
| Concurrent invalidations | Upsert + unique constraint; last write wins acceptable for v1. |
| AI failure | Return error to client; banner shows error state; next invalidation retries. |
| Customers mode, person unlinked mid-session | `personId` change resets query key; new fetch. |

---

## File-by-file change checklist (implementation phase)

| File | Action |
|------|--------|
| `supabase/migrations/…_create_inbox_ai_thread_summaries.sql` | **Create** table, constraints, indexes, RLS, comments. |
| `supabase/functions/inbox-ai-thread-summary/index.ts` | **Create** Edge Function. |
| `supabase/functions/_shared/…` (optional) | **Extract** shared `stripHtml` / OpenAI JSON parse helpers if duplicating suggest-reply. |
| `src/modules/inbox/hooks/useThreadSummary.ts` | **Create** hook. |
| `src/modules/inbox/components/ConversationSummaryBanner.tsx` | **Create** UI. |
| `src/modules/inbox/components/ConversationView.tsx` | **Insert** banner + hook. |
| `src/modules/inbox/components/CustomerConversationView.tsx` | **Insert** banner + hook. |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | **Add** summary invalidation alongside inbox refresh. |
| `src/modules/inbox/hooks/useInboxConversations.ts` | **Add** invalidation on mutations affecting messages/conversations. |
| `src/modules/inbox/hooks/useInboxMessages.ts` | **Add** invalidation after successful send (if not covered by central invalidation). |
| `src/shared/types/database.types.ts` (if used) | **Regenerate** or manually add types for new table. |

---

## Risks

- **Cost / latency:** Full-thread prompts on every invalidation until fingerprint matches; mitigated by fingerprint short-circuit.
- **Heuristic truncation:** If prompt is truncated, summary may miss early context; acceptable for v1 if documented.
- **Fingerprint collisions:** Use cryptographic hash over ordered ids+timestamps to avoid false cache hits.
- **RLS drift:** Must match evolving `inbox_conversations` / `inbox_messages` ownership rules.

---

## Acceptance criteria

- [ ] Summary appears under header in **Conversations** and **Customers** modes when messages exist and AI is configured.
- [ ] New inbound/outbound message (after existing inbox refresh) causes summary to **update** without manual action.
- [ ] Re-opening same thread with **no** message changes does **not** repeatedly call OpenAI (fingerprint hit).
- [ ] Email/HTML content does not break JSON parsing (strip HTML server-side).
- [ ] No schema changes to `inbox_messages` / `inbox_conversations` beyond new FKs from the summary table.
- [ ] Loading and error states are non-blocking and calm (match suggest-reply tone).

---

## Specify workflow note

`create-new-feature.sh` was **not** executed successfully in this environment (bash working directory). **Suggested git branch:** `feature/inbox-ai-conversation-summary`. **This document:** `specs/inbox-ai-conversation-summary.md`.

**Readiness:** Ready for `/plan` and `/implement` phases.
