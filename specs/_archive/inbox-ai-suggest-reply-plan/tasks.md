# Tasks: AI Suggested Reply for Unified Inbox

## Phase 0: Database [X]

### 0.1 Migration — create inbox_ai_suggestions + RLS [X]

- **File:** `supabase/migrations/20260206120000_create_inbox_ai_suggestions.sql` (or next available timestamp).
- **Steps:**
  1. Create table `public.inbox_ai_suggestions`:
     - `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
     - `message_id` uuid NOT NULL REFERENCES public.inbox_messages(id) ON DELETE CASCADE
     - `suggestion_text` text NOT NULL
     - `created_at` timestamptz NOT NULL DEFAULT now()
  2. Add unique constraint on `message_id`: `CREATE UNIQUE INDEX idx_inbox_ai_suggestions_message_id ON public.inbox_ai_suggestions (message_id);`
  3. Enable RLS: `ALTER TABLE public.inbox_ai_suggestions ENABLE ROW LEVEL SECURITY;`
  4. Policy SELECT: allow authenticated users who can read the related inbox_messages row (tenant-scoped via EXISTS subquery). No INSERT/UPDATE/DELETE for authenticated; only service role (Edge Function) may insert.
- **Reference:** `.cursor/rules/create-migration.mdc`, `.cursor/rules/create-rls-policies.mdc` if present.

---

## Phase 1: Edge Function inbox-ai-suggest-reply [X]

### 1.1 Create function

- **Path:** `supabase/functions/inbox-ai-suggest-reply/index.ts`
- **Steps:**
  1. Parse request: POST, body `{ message_id: string }`. Return 400 if missing or invalid uuid.
  2. Verify Supabase auth: get JWT from Authorization header; verify with createClient(anonKey) and getUser() or equivalent so only authenticated users can call. Return 401 if not authenticated.
  3. Create Supabase **service role** client for server-side DB access.
  4. Fetch `inbox_messages` row by id (service role). If not found, return 404. If `direction !== 'inbound'`, return 404.
  5. Look up `inbox_ai_suggestions` by `message_id`. If found, return 200 with `{ suggestion: row.suggestion_text }`.
  6. Get message body (e.g. `body_text`); strip HTML if needed to plain text for the prompt.
  7. Call OpenAI Responses API (model `gpt-4o-mini`) with:
     - Input: single user message containing the inbound message body.
     - System/instruction: ask for a brief professional reply in one or two sentences; output only JSON with key `suggestion` (string).
     - Use structured output or parse JSON from response.
  8. Insert into `inbox_ai_suggestions` (message_id, suggestion_text). On conflict (message_id) do nothing or update — ensure unique constraint is respected.
  9. Return 200 with `{ suggestion: suggestion_text }`.
  10. On OpenAI or DB errors, return 500 with `{ error: "..." }`.
- **Secrets:** Set `OPENAI_API_KEY` in Supabase Edge Function secrets.
- **CORS:** Include standard CORS headers for browser requests.

### 1.2 Response shape

- Success: `{ suggestion: string }`
- Error: `{ error: string }` with status 400 / 401 / 404 / 500.

---

## Phase 2: Frontend — hook and API [X]

### 2.1 API / invoke

- **Option A:** Add a small API helper that calls `supabase.functions.invoke('inbox-ai-suggest-reply', { body: { message_id } })` and returns the parsed body. File: e.g. `src/modules/inbox/api/inboxAiSuggest.api.ts`.
- **Option B:** Call `supabase.functions.invoke` directly from the hook. Either way, the request must send the user's session (Supabase client already uses anon key + session).

### 2.2 Hook useSuggestedReply(messageId)

- **File:** `src/modules/inbox/hooks/useSuggestedReply.ts` (new) or add to an existing hooks file.
- **Signature:** `useSuggestedReply(messageId: string | null)`.
- **Behavior:**
  - When `messageId` is null or empty, return `{ suggestion: null, isLoading: false, error: null }` and do not call the function.
  - When `messageId` is set, call the Edge Function (or API helper) with `{ message_id: messageId }`.
  - Use React Query (e.g. `useQuery`) with key `['inbox', 'ai-suggest', messageId]` so the same message is not refetched repeatedly; or use a simple useState/useEffect with a ref to avoid duplicate in-flight requests.
  - Return `{ suggestion: string | null, isLoading: boolean, error: Error | null }` (or refetch function for retry).
- **Stability:** Do not invalidate other query keys (conversations, messages); keep this hook isolated.

---

## Phase 3: UI — chip and composer integration [X]

### 3.1 Locate composer and last inbound message

- **File:** `src/modules/inbox/components/ConversationThread.tsx`
- **Composer state:** `replyText`, `setReplyText`; controlled `<Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} />`.
- **Last inbound message:** From `messages` prop, compute `lastInboundMessage = messages.slice().reverse().find(m => m.direction === 'inbound')`; use `lastInboundMessage?.id` as the message id for the suggestion.

### 3.2 Add suggestion chip above composer

- **File:** `src/modules/inbox/components/ConversationThread.tsx`
- **Placement:** Inside the composer block (the `div` with `ref={composerRef}`), after the replyTo chip and channel select (if any), **before** the `<Textarea>`.
- **Logic:**
  - Call `useSuggestedReply(lastInboundMessage?.id ?? null)` (need to compute lastInboundMessage from messages).
  - When `isLoading`: show a loading chip or placeholder (e.g. "Suggesting reply…") so layout is stable.
  - When `error`: show a small error message or "Couldn't load suggestion" with optional retry; do not block the composer.
  - When `suggestion` is present: render a single chip (e.g. Badge or Button variant) with truncated suggestion text (e.g. first 50 chars + "…"). On click: `setReplyText(suggestion)` (or append; spec says insert — set is acceptable). Do not auto-send.
- **Stability:** Reserve a single line or two for the chip/loading/error area so the composer does not jump when the suggestion appears.

### 3.3 No changes to scroll or auto-read

- Do not modify `scrollContainerRef`, message list scroll behavior, or auto-read logic in `UnifiedInboxPage` or `ConversationView`.

---

## Phase 4: Testing and acceptance

### 4.1 Manual testing steps

1. **DB:** Run migration; confirm table `inbox_ai_suggestions` exists with unique(message_id) and RLS enabled.
2. **Edge Function:** Deploy; set OPENAI_API_KEY. Call with valid message_id (inbound) → 200 and `{ suggestion: "..." }`. Call again with same message_id → 200 and same suggestion (cached). Call with invalid message_id → 400. Call with outbound message_id → 404. Call without auth → 401.
3. **UI:** Open a conversation that has at least one inbound message. Confirm a loading state appears, then either a suggestion chip or an error. Click the chip → composer text is set to the suggestion; user can edit and send. Switch to another conversation → new suggestion loads for that conversation's last inbound message. No scroll or auto-read regressions.
4. **Stability:** Confirm no extra rerenders (e.g. suggestion fetch does not invalidate conversation list or messages).

### 4.2 Acceptance criteria

- [ ] One suggested reply per conversation, based on last inbound message only.
- [ ] Suggestion shown as a single chip above the composer; click inserts into composer (no auto-send).
- [ ] Cache: same message_id returns cached suggestion (no duplicate OpenAI call).
- [ ] Loading and error states present; composer always usable.
- [ ] Scroll guard and auto-read behavior unchanged.
- [ ] OpenAI API key never exposed to the client.

---

## Summary: exact files

| File | Action |
|------|--------|
| `supabase/migrations/20260206120000_create_inbox_ai_suggestions.sql` | Create (table, unique, RLS, policies). |
| `supabase/functions/inbox-ai-suggest-reply/index.ts` | Create (full Edge Function). |
| `src/modules/inbox/api/inboxAiSuggest.api.ts` | Create (optional; invoke Edge Function). |
| `src/modules/inbox/hooks/useSuggestedReply.ts` | Create (or add in existing hook file). |
| `src/modules/inbox/components/ConversationThread.tsx` | Edit (add lastInboundMessage, useSuggestedReply, chip above Textarea, setReplyText on click). |
