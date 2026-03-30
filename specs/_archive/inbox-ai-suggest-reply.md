# AI Suggested Reply for Unified Inbox (Single Suggestion Chip)

## Overview

Add a single AI-generated reply suggestion for the Unified Inbox: when a conversation is selected, automatically generate one suggested reply for the **last inbound message**, show it as a **chip** above the composer, and allow the user to insert it into the composer with one click. Generation runs server-side via a new Supabase Edge Function calling the OpenAI Responses API; suggestions are cached per `message_id` so we do not regenerate repeatedly. The OpenAI API key stays server-side only.

**Context:**
- Mason app: React + TypeScript, Supabase (RLS), no custom Node server.
- Inbox: `inbox_conversations`, `inbox_messages`; ConversationView → ConversationThread with composer; scroll guard and auto-read logic must remain unchanged.
- AI is assistive only: user explicitly chooses to use the suggestion (chip click = insert into composer).

**Goal:**
- One suggested reply per conversation view, derived from the last inbound message only (no extra context for now).
- Cache per message so repeated views or re-opens do not call the API again for the same message.
- Preserve existing inbox stability (scroll guard, auto-read, no unnecessary rerenders).
- Deliver: Edge Function, DB cache table + RLS, frontend hook + chip UI, error and loading handling.

---

## Current State Analysis

### inbox_messages Schema

**Table:** `public.inbox_messages`

**Current structure (from usage and migrations):**
- `id`, `conversation_id`, `channel`, `direction` ('inbound' | 'outbound'), `from_handle`, `to_handle`, `body_text`, `subject`, `sent_at`, `status`, `created_at`, `updated_at`, `external_message_id`.
- Messages are fetched by `conversation_id` and ordered by `sent_at`; the "last inbound" is the most recent row with `direction = 'inbound'`.

**Observations:**
- No existing table or column for AI suggestions. A new cache table is required.

### ConversationThread / Composer

**Current structure:**
- `ConversationView` renders `ConversationThread` with `messages`, `conversationId`, `channel`, and `scrollContainerRef`. The composer (reply input) lives inside or next to the thread. No suggestion chip exists today.

**Observations:**
- Suggestion chip must sit above the composer without changing scroll or layout behavior; insertion into composer is a single action (e.g. set composer text or append).

### Relationship Analysis

**Current:** Messages belong to a conversation; the UI shows messages and a composer for that conversation. There is no link between messages and AI-generated content.

**Gap:** Need a cache keyed by message (e.g. `message_id`) so that one suggestion is stored per "last inbound message" and reused when the user re-opens the same conversation or the same message is still last.

---

## Recommended Schema Adjustments

### Database Changes

**New table: `public.inbox_ai_suggestions`**

- `id` uuid PRIMARY KEY default gen_random_uuid()
- `message_id` uuid NOT NULL REFERENCES public.inbox_messages(id) ON DELETE CASCADE
- `suggestion_text` text NOT NULL
- `created_at` timestamptz NOT NULL default now()
- Unique constraint (or unique index) on `message_id` so at most one suggestion per message.

**Migrations:**
- Create `inbox_ai_suggestions` with the columns above and a unique constraint on `message_id`.
- Enable RLS; policies: allow select/insert for authenticated users (or align with existing inbox RLS pattern so that only rows for messages in conversations the user can access are visible/insertable). Use `(select auth.uid())` in policies per project conventions.

**Non-destructive:** Additive only; no changes to `inbox_messages` or `inbox_conversations` beyond a possible FK from the new table to `inbox_messages`.

### Query/Data-Access Alignment

**Recommended patterns:**
- Fetch suggestion by `message_id`: when the frontend has the last inbound message id, call the Edge Function with that id (or fetch from DB if the Edge Function writes to the cache and returns the suggestion). Alternatively: frontend calls Edge Function with `message_id`; Edge Function checks cache table first, returns cached row if present, otherwise calls OpenAI, writes to cache, returns suggestion.
- Display: one chip per conversation view when a suggestion exists; loading state while the request is in flight; error state if the request fails (no chip or retry).

---

## Implementation Approach

### Phase 1: Backend — Edge Function and DB

- **1.1** Migration: create `inbox_ai_suggestions` (id, message_id FK to inbox_messages, suggestion_text, created_at), unique on message_id, RLS enabled, policies for select/insert (and update if needed) consistent with inbox access.
- **1.2** New Edge Function `inbox-ai-suggest-reply`:
  - Input: `message_id` (uuid).
  - Validate message exists and is inbound; optionally verify conversation access (e.g. via RLS or a join check).
  - Look up `inbox_ai_suggestions` by `message_id`; if found, return cached `suggestion_text`.
  - If not found: fetch message body (e.g. `body_text`) for that message, call OpenAI Responses API to generate one short suggested reply (e.g. one sentence), store result in `inbox_ai_suggestions`, return suggestion text.
  - Use only the last inbound message content (no extra context). Do not expose OpenAI API key to the client.
  - Return shape: `{ suggestion_text: string }` or `{ error: string }`; appropriate status codes (e.g. 200, 400, 404, 500).
- **1.3** Environment: Edge Function uses `OPENAI_API_KEY` (or equivalent) from Supabase secrets.

### Phase 2: Frontend — Hook and API

- **2.1** API helper: e.g. `fetchSuggestReply(messageId: string): Promise<{ suggestion_text: string }>` calling the Edge Function with auth headers (same pattern as other inbox Edge Functions).
- **2.2** Hook: e.g. `useSuggestReply(lastInboundMessageId: string | null)` that:
  - Is enabled only when `lastInboundMessageId` is non-null.
  - Calls the API and returns `{ suggestionText, isLoading, error }` (or equivalent). Uses React Query or local state; cache key can include `message_id` so the same message does not trigger repeated requests (React Query cache or one-time fetch with cache table doing the real dedup).
  - Does not cause unnecessary rerenders (e.g. stable keys, no broad invalidation of conversation list).

### Phase 3: UI — Chip and Composer Integration

- **3.1** In the composer area (ConversationThread or dedicated composer component): when a conversation is selected, compute the last inbound message (from existing `messages` array: last item with `direction === 'inbound'`). Pass its `id` to `useSuggestReply`.
- **3.2** Render one suggestion chip above the composer when `suggestionText` is present. Loading: show a loading chip or placeholder. Error: show error state (e.g. small error text or retry); do not block the composer.
- **3.3** On chip click: insert `suggestionText` into the composer (set or append to the input value). Do not auto-send; user can edit and send as usual.
- **3.4** Preserve existing scroll guard and auto-read logic; avoid layout shifts or extra rerenders (e.g. do not subscribe to realtime on the suggestions table unless needed; single request per last-inbound message id is sufficient).

### Phase 4: Error Handling and Loading

- **4.1** Edge Function: return clear error payload for invalid message_id, missing message, OpenAI failure, or DB failure; use 4xx/5xx appropriately.
- **4.2** Frontend: handle loading (disable chip or show skeleton), error (message + optional retry), and empty state (no suggestion or no last inbound).

### Safety Considerations

- Do not send more context than the single message body to OpenAI (comply with "only last inbound message content").
- Rate-limit or cost considerations: cache ensures one generation per message; document any limits if needed.
- RLS on `inbox_ai_suggestions` must align with who can see the underlying message/conversation.

---

## What NOT to Do

- Do not expose the OpenAI API key to the client.
- Do not generate suggestions client-side.
- Do not add multiple suggestion chips for multiple messages (single chip for last inbound only).
- Do not change scroll guard, auto-read behavior, or realtime subscription logic in the inbox.
- Do not auto-send the suggestion on chip click; only insert into composer.
- Do not introduce unnecessary rerenders or broad cache invalidation for the rest of the inbox.

---

## Deliverables Checklist

- [ ] New Edge Function: `inbox-ai-suggest-reply` (Supabase Edge Function calling OpenAI Responses API; cache in DB by message_id).
- [ ] DB table `inbox_ai_suggestions` + RLS (message_id, suggestion_text, unique on message_id).
- [ ] Frontend: API helper + hook (e.g. `useSuggestReply(lastInboundMessageId)`).
- [ ] UI: Single suggestion chip above composer; click inserts into composer; loading and error states.
- [ ] Error handling and loading state as above.

---

## Open Questions / Considerations

- **Model and prompt:** Which OpenAI model (e.g. gpt-4o-mini or responses API default) and exact prompt (e.g. "Suggest a brief professional reply to this message") to be defined in the Edge Function.
- **Auth:** Edge Function must accept the same auth pattern as other inbox functions (e.g. anon key + optional admin token or auth.uid()) and enforce that the user can only request suggestions for messages in conversations they can access.
- **Composer component:** Confirm where the reply input lives (ConversationThread or a child) so the chip is placed "above the composer" without breaking layout.
