# Phase 0 – Research: Per-user WhatsApp connection

## Feature spec reference

- [specs/per-user-whatsapp-connection.md](../per-user-whatsapp-connection.md)

## Verified codebase facts

### Twilio and inbox

- **Inbound webhook:** Implemented in `supabase/functions/twilio-sms-webhook/index.ts`. Deployed as `twilio-sms-webhook` (not `inbox-twilio-inbound`). Handles both SMS and WhatsApp via `From`/`To` format (`whatsapp:` prefix).
- **Outbound send:** `supabase/functions/inbox-twilio-send/index.ts`. Uses env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Auth: `x-admin-token` vs `INBOX_ADMIN_TOKEN`; no JWT today. Does not set `user_id` on inserted outbound message; does not load conversation `user_id`.
- **Conversation/message creation (inbound):** Current webhook does **not** set `user_id` on new `inbox_conversations` or `inbox_messages` (inserts omit user_id → NULL). RLS hides those rows from authenticated users (SELECT where user_id = auth.uid()).

### Inbox tables and RLS

- **Migrations:** `supabase/migrations/20260218130000_add_user_id_to_inbox_tables_rls.sql` adds `user_id` to `inbox_conversations` and `inbox_messages`, enables RLS, policies: select/update by `user_id = (select auth.uid())`. No insert policy for authenticated (client); inserts are by service role in Edge Functions.
- **Gmail attribution:** `inbox_messages` has `gmail_connection_id` (FK to gmail_connections). Parallel: add `whatsapp_connection_id` to `inbox_messages`.

### Customer linking

- **Auto-link:** `twilio-sms-webhook` calls `attemptAutoLink(supabase, conversationId, channel, from.trim())`. Uses `customers` table: match by `phone` for sms/whatsapp, sets `inbox_conversations.person_id` to `customers.id`. No use of `people.id`; `person_id` is customers.id. Spec requirement “customers.id only” is already satisfied.

### Gmail connection UI (pattern to mirror)

- **Components:** `src/modules/inbox/components/GmailConnectionPanel.tsx`, `GmailConnectionStatus.tsx`.
- **Hooks:** `src/modules/inbox/hooks/useGmailConnection.ts` (and useGmailConnect, useGmailDisconnect) — exact path to confirm by grep.
- **Placement:** `DashboardLayout.tsx` imports and renders `GmailConnectionStatus` in the header. No separate “Profile” page for Gmail; connection is in header.
- **Pattern:** Card with status; Connect / Replace / Disconnect buttons; no tokens sent from client (OAuth flow for Gmail). For WhatsApp we need a form (SID, Key SID, Secret, From) submitted to Edge Function; secret never stored on client.

### Encryption and secrets

- No existing Supabase Vault/pgsodium usage in migrations. Gmail tokens stored in `gmail_connections` (access_token, refresh_token) — likely plaintext in DB; Twilio secret must be encrypted. Options: app-level encryption in Edge Function (env key) or Vault; spec recommends one of the two.

## Files to inspect before editing

| Purpose | File(s) |
|--------|---------|
| Webhook lookup and insert shape | `supabase/functions/twilio-sms-webhook/index.ts` (full file) |
| Send auth and env usage | `supabase/functions/inbox-twilio-send/index.ts` (full file) |
| Inbox RLS and columns | `supabase/migrations/20260218130000_add_user_id_to_inbox_tables_rls.sql` |
| Gmail table shape | `supabase/migrations/20260218120000_create_gmail_connections.sql` |
| Gmail UI and hooks | `src/modules/inbox/components/GmailConnectionPanel.tsx`, `GmailConnectionStatus.tsx`; `src/modules/inbox/hooks/useGmailConnection*` |
| Layout integration | `src/app/layout/DashboardLayout.tsx` |
| Inbox conversation select (user_id) | Any component that fetches inbox list (e.g. UnifiedInboxPage or similar) |
| Companies table | `supabase/migrations/` — grep for `create table.*companies` |

## Ambiguities to resolve

1. **Normalize `To` for lookup:** Twilio sends `To` as `whatsapp:+44...` or `+44...`. Stored `whatsapp_from` should match. Recommendation: normalize to E.164 (e.g. strip `whatsapp:`) in both webhook and when storing, and compare normalized values.
2. **Status enum:** Use `'active'` (to align with gmail_connections) or `'connected'`; use same value in partial unique index and in code.
3. **disconnected_at:** User requested column; add to schema for audit/reporting.
4. **Backfill:** Legacy conversations (user_id NULL) from current Sandbox will stay hidden. Decide if a one-off backfill to a designated user is required.
