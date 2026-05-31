# Project Handoff — Mason App, GHL Integration Phase 2 (Outbound Send)

## Purpose of this chat
Build outbound messaging into the Mason GHL Inbox. Phase 1 (read-through) and the multi-org credential refactor are shipped and live in production for two orgs (Churchill, Sears Melvin). This phase enables Mason staff to SEND messages out through GHL to customers (WhatsApp / SMS / email), turning the currently read-only inbox into a two-way surface. This is new feature work building ON TOP of a working, validated foundation.

## What already exists and works (do NOT rebuild)
- GHL Inbox module at /dashboard/ghl-inbox (src/modules/ghl-inbox/): conversation list, message thread, contact panel, admin status strip.
- Read-through via ghl-fetch edge function (listConversations, getMessages, getContact) — live from GHL, no message data stored in Mason.
- Mark-as-read via ghl-mark-read (cheap path: PUT conversation unreadCount:0, with message-status fallback). Optimistic UI clears badge instantly.
- Live updates via ghl-webhook (GHL workflow Custom Webhook -> shared-secret auth -> pulse ghl_connections.updated_at -> Realtime -> React Query invalidate). See specs/010-ghl-multi-org/live-updates.md.
- Multi-org per-org encrypted PITs: ghl_connections.ghl_api_key (bytea, pgcrypto), decrypted via get_ghl_api_key(p_connection_id, p_encryption_key) RPC (service_role only). Key from GHL_API_KEY_ENCRYPTION_KEY edge secret.
- The disabled composer is ALREADY BUILT: GhlReadOnlyComposer.tsx renders at the bottom of the thread with "Read-only preview — outbound coming in Phase 2". Phase 2 swaps its behavior, not its position.

## What Phase 2 adds
- New edge function ghl-send-message: receives {organizationId, conversationId, message, channel?} from frontend, resolves the org's connection + decrypted PIT (reuse getActiveGhlConnectionWithKey from _shared/ghlClient.ts), calls GHL's send-message endpoint, returns result. PIT never reaches browser.
- Enable the composer: replace the disabled GhlReadOnlyComposer with a working send box (text input, send button, channel awareness, error/sending states).
- useGhlSendMessage hook: mutation calling ghl-send-message, optimistic append of the sent message to the thread, invalidate on success.

## Settled decisions (carry forward from Phase 1 / multi-org)
- GHL API v2, services.leadconnectorhq.com, Version: 2021-07-28 header.
- Per-org PIT auth (already working). ghl-send-message uses the same getActiveGhlConnectionWithKey pattern as ghl-fetch / ghl-mark-read.
- Parallel module — do NOT touch the existing inbox_* tables.
- Read-through stays: no message bodies persisted in Mason. Sent messages go to GHL; the thread re-fetches from GHL.
- Deploy edge functions via CLI (npx supabase functions deploy), NOT dashboard. ghl-webhook specifically needs --no-verify-jwt; send/fetch/mark-read do NOT.
- Migration discipline: any schema change = committed migration file in supabase/migrations/, user-applied via dashboard, never auto-pushed.
- Production Supabase ref: bfwohzcugtwbhhxdqgme.

## OPEN decisions to resolve BEFORE building
1. Sender attribution — does an outbound message appear in GHL as the Mason user (needs ghl_user_mappings table mapping mason_user -> ghl_user_id), the org default GHL user, or configurable? Affects schema + send payload. [DEFAULT: org default for v1 — simplest, no mapping table. For a small shared-inbox business that operates as one voice to customers, per-staff attribution is usually not needed. BUT confirm with the client during Phase 2 planning: "Do you need to know which staff member sent each reply?" If no (likely), org-default is permanent and saves a whole subsystem. If yes, build ghl_user_mappings from the start rather than retrofitting.]
2. Send-message endpoint + scope — VERIFY against GHL docs that conversations/message.write permits SENDING new messages (POST /conversations/messages), not just status updates. If a different/additional scope is needed, both PITs must be regenerated with it. CONFIRM BEFORE CODING.
3. Channel selection — GHL conversations have a channel (SMS/WhatsApp/email). Does the composer auto-use the conversation's existing channel, or let the user pick? [DEFAULT: reply on the conversation's existing channel; no picker in v1.]
4. WhatsApp 24-hour window — WhatsApp business messaging restricts free-form messages outside a 24h window from the customer's last message (template-only after). Does v1 handle this, or just attempt-and-surface-the-error? [DEFAULT: attempt and surface GHL's error; template handling is a later phase.]

## Rollout caution (outbound writes to LIVE customers)
- This is the first capability that sends to real customer phones/emails. A bug here reaches an actual customer, unlike everything in Phase 1.
- [RECOMMENDED] Feature-flag the send capability. Test against your OWN phone number first (add yourself as a test contact in a sub-account). Enable per-org only after a clean test.
- Add idempotency: a double-click or retry must not send twice. Consider a client-side send-in-progress lock + a server-side dedupe if GHL doesn't provide idempotency keys.
- Churchill is a live business account — coordinate any test sends, or test only against Sears Melvin / your own number.

## Suggested first moves
1. Verify GHL send-message endpoint + required scope against current docs (marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message or similar). Confirm the PITs' existing scopes suffice; regenerate if not.
2. Resolve the 4 open decisions above (or accept the defaults).
3. Run /speckit.specify for Phase 2 with this doc as input.
4. Build ghl-send-message, deploy via CLI, test against your own number behind a flag, then enable the composer.

## Known cautions specific to this project (still apply)
- Placeholder substitution in SQL: replace <...> placeholders with real values before running; the editor does not substitute them.
- Dashboard "Redeploy" does NOT pull local code — always use CLI deploy.
- Schema-cache: new RPCs need PostgREST to refresh (NOTIFY pgrst, 'reload schema' or a function redeploy) before edge functions can call them.
- GHL location IDs: capital-I vs lowercase-l confusion bit us once; copy IDs via the GHL UI copy button, never transcribe by eye.
- Secrets go to Bitwarden first, never pasted into chat or committed.
