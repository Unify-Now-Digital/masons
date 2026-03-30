# Research: AI Suggested Reply for Unified Inbox

## Hard decisions (fixed)

- **Provider:** OpenAI via Responses API, invoked from a Supabase Edge Function.
- **Model:** `gpt-4o-mini`.
- **Input:** Last inbound message only (single message body; no extra context).
- **Output:** One suggestion string (e.g. one short reply).
- **Cache:** DB table `inbox_ai_suggestions` with unique constraint on `message_id`; one row per message.
- **Auth:** Edge Function requires Supabase auth (user must be authenticated). Inside the function use the **service role** client to read `inbox_messages` and read/write `inbox_ai_suggestions` (bypass RLS for server-side logic); validate that the message belongs to a conversation the user can access (e.g. by checking conversation exists and optionally using RLS on a separate select with anon client, or by convention that only authenticated requests with valid JWT are accepted and message_id is validated server-side).
- **Trigger:** Auto when a conversation is selected and the last inbound message is known; no manual "Generate" button. Optional "regenerate" can be deferred (not in initial scope).

## Edge Function contract

- **Request:** POST, body `{ message_id: string }` (uuid).
- **Steps:** (1) Validate JWT / require auth. (2) Fetch `inbox_messages` row by id (service role). (3) Validate `direction === 'inbound'`. (4) Optional: verify user has access to the conversation (e.g. conversation exists; if multi-tenant, check tenant). (5) Look up `inbox_ai_suggestions` by `message_id`; if found, return `{ suggestion: string }`. (6) Else call OpenAI Responses API with structured output `{ suggestion: string }`, store in `inbox_ai_suggestions`, return `{ suggestion: string }`.
- **Errors:** 400 invalid/missing message_id; 404 message not found or not inbound; 500 OpenAI or DB error. Response body: `{ error: string }`.
- **OpenAI:** Use Responses API with response format (e.g. JSON schema) so the model returns exactly `{ suggestion: string }`. Prompt: e.g. "Suggest a brief, professional reply to this message. Reply in one or two short sentences. Output only valid JSON with a single key 'suggestion'." Input: message body text only.

## Frontend integration

- **Composer location:** `ConversationThread` in `src/modules/inbox/components/ConversationThread.tsx`. Composer state: `replyText` and `setReplyText`; the reply input is a controlled `<Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} />`. The composer block is the div with `ref={composerRef}` (border-t pt-4), containing optional replyTo chip, optional channel select, then Textarea, error, and Send button.
- **Last inbound message:** From `messages` (prop), compute as the last item with `direction === 'inbound'` (e.g. iterate from end). Use its `id` as `messageId` for the suggestion request.
- **Invocation:** Use `supabase.functions.invoke('inbox-ai-suggest-reply', { body: { message_id: messageId } })` so the request is sent with the user's session (Bearer token). No need for a separate API helper file if we keep the call in the hook; alternatively add `inboxAiSuggest.api.ts` and call from the hook.
- **Chip placement:** Render the suggestion chip **above** the Textarea, inside the same composer block (e.g. after replyTo and channel select, before the Textarea). Clicking the chip sets `setReplyText(suggestion)` (or appends; spec says "insert" — set is simpler and matches "one suggestion").
- **Stability:** Do not change scroll container ref, message list, or auto-read logic. The chip is additive UI; loading/error state should not block the composer or cause layout jump (e.g. reserve a small line for chip/loading/error so height is stable).

## RLS and security

- **inbox_ai_suggestions:** RLS enabled. Policies: allow select and insert for authenticated users. Because the Edge Function uses the service role, it does not go through RLS; the security boundary is "only call the Edge Function with a message_id the user can see". The Edge Function should validate that the message exists and is inbound, and optionally that the conversation is accessible (e.g. by joining to inbox_conversations and checking a tenant column or by trusting that the client only sends message_ids from the current conversation view). For simplicity, require auth and validate message exists + inbound; conversation access can be enforced by ensuring the UI only ever sends the last inbound message id of the currently selected conversation.
