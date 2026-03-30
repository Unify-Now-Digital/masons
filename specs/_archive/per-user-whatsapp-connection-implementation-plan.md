# Per-user WhatsApp connection — Implementation plan

**Feature spec:** [specs/per-user-whatsapp-connection.md](per-user-whatsapp-connection.md)  
**Plan artifacts:** [specs/per-user-whatsapp-connection-plan/](per-user-whatsapp-connection-plan/)

*Note: Plan was generated manually; `.specify/scripts/bash/setup-plan.sh` targets a different spec and was not used.*

---

## Technical context (from arguments)

- **Stack:** React + TypeScript + Vite + Tailwind + shadcn/ui (frontend); Supabase with Postgres, RLS, Auth, Edge Functions (backend).
- **Inbox:** Per-user; existing `inbox_conversations.user_id` and `inbox_messages.user_id` are owner fields (no new `owner_user_id`).
- **Current WhatsApp:** Test mode via `inbox-twilio-send` and Twilio webhook (`twilio-sms-webhook`). Inbound is `supabase/functions/twilio-sms-webhook`; outbound is `supabase/functions/inbox-twilio-send`.
- **Agreed:** One row per user in `public.whatsapp_connections`; inbound routing by `(twilio_account_sid, whatsapp_from)`; disconnect preserves history read-only; customers is base table (person_id = customers.id); webhook lookup index `where status = 'active'` (or `'connected'` — decide one and use consistently).
- **Encryption:** Twilio API secret never stored plaintext; decrypt only in Edge Functions.
- **Profile UI:** Status, connected sender, Connect / Replace / Disconnect / Test. Gmail pattern lives in `GmailConnectionPanel` / `GmailConnectionStatus`; header shows `GmailConnectionStatus` in `DashboardLayout.tsx`.

---

## Progress tracking

| Phase | Status | Artifact(s) |
|-------|--------|-------------|
| 0 – Research | ✅ Complete | research.md |
| 1 – Data model & contracts | ✅ Complete | data-model.md, contracts/, quickstart.md |
| 2 – Tasks | ✅ Complete | tasks.md |

---

## Implementation phases (safest order)

### Phase 0 – Research and verification

- **Goal:** Confirm codebase facts and list files to touch.
- **Artifact:** `specs/per-user-whatsapp-connection-plan/research.md`.
- **Actions:** Verify Twilio webhook name (confirmed: `twilio-sms-webhook`); confirm inbox RLS and `user_id` usage; confirm auto-link uses `customers.id` only (`person_id`); confirm where Gmail connection UI lives (header + components); note any ambiguity for implementation.

### Phase 1 – Database and RLS

- **Goal:** Add `whatsapp_connections` and optional `inbox_messages.whatsapp_connection_id`; RLS for `whatsapp_connections`; no change to existing inbox RLS.
- **Order:** Run migrations in sequence; no dependency on Edge Functions yet.
- **Artifacts:** `data-model.md`, migration file list in tasks.
- **Risks:** If `companies` table does not exist, `company_id` stays nullable without FK (document in migration comment).
- **Verify before coding:** Existence of `public.companies` (grep migrations).

### Phase 2 – Credential storage and encryption

- **Goal:** Define encryption approach (Vault vs app-level) and implement connect/validate Edge Function that accepts credentials, validates with Twilio, encrypts secret, and writes `whatsapp_connections`.
- **Order:** After Phase 1 so table exists. Implement one Edge Function (e.g. `whatsapp-connect` or `whatsapp-validate`) that both validates and stores; or separate validate + RPC that calls shared encrypt helper.
- **Artifacts:** contracts for connect/validate API; quickstart step for secret env.
- **Risks:** Key rotation not in v1; document in quickstart.

### Phase 3 – Inbound webhook routing

- **Goal:** Update `twilio-sms-webhook` to resolve owner from `whatsapp_connections` by (AccountSid, To); set `user_id` and optional `whatsapp_connection_id` on conversation and message; do not create conversation if no matching connection (return 200).
- **Order:** After Phase 1 and 2 so connections can exist. Prefer minimal change: add lookup at start; if no row, return 200 empty TwiML (no new conversation).
- **Files:** `supabase/functions/twilio-sms-webhook/index.ts`.
- **Verify before coding:** Normalize `To` to same format as stored `whatsapp_from` (e.g. E.164 without `whatsapp:` prefix) so lookup matches; see research.md.

### Phase 4 – Outbound send (per-user credentials)

- **Goal:** `inbox-twilio-send` uses JWT to get `auth.uid()`; load conversation and verify `conversation.user_id = auth.uid()`; load user’s active `whatsapp_connections` row; decrypt secret; send via Twilio API using connection’s `whatsapp_from`; set `user_id` and `whatsapp_connection_id` on inserted message.
- **Order:** After Phase 2 (decrypt available). Deprecate or keep `x-admin-token` only for legacy Sandbox if desired.
- **Files:** `supabase/functions/inbox-twilio-send/index.ts`.
- **Verify before coding:** How frontend calls send (headers, body); ensure JWT is sent.

### Phase 5 – Frontend: WhatsApp connection UI

- **Goal:** Profile/header WhatsApp block: status, connected sender, Connect / Replace / Disconnect / Test. Mirror Gmail pattern; no secret sent from client.
- **Order:** After Phase 2 so connect/validate and disconnect RPC or Edge Function exist.
- **Files:** New components/hooks under `src/modules/inbox/` (e.g. `WhatsAppConnectionPanel`, `WhatsAppConnectionStatus`); integrate in `DashboardLayout.tsx` (e.g. next to Gmail); new hooks `useWhatsAppConnection`, `useWhatsAppConnect`, `useWhatsAppDisconnect`, `useWhatsAppTest`.
- **Verify before coding:** Where “Profile” lives — currently Gmail is in header via `GmailConnectionStatus`; decide if WhatsApp is header-only or also a dedicated settings page.

### Phase 6 – Test and disconnect flows

- **Goal:** Test: Edge Function that sends test message using user’s credentials. Disconnect: set `status = 'disconnected'` (and optionally `disconnected_at = now()`); do not delete row; history remains visible.
- **Order:** After Phase 4 and 5. Optional: `whatsapp-test` Edge Function; disconnect can be client update to `whatsapp_connections` via RLS (user updates own row) or Edge Function.

### Phase 7 – Validation, errors, rollout

- **Goal:** Centralize validation and error handling; document rollout (Sandbox first, then production); list risks and dependencies.
- **Artifacts:** tasks.md (validation/error tasks); quickstart (rollout); this plan (risks/dependencies).

---

## Files and modules likely to change

| Area | File(s) / module | Change |
|------|-------------------|--------|
| Migrations | `supabase/migrations/` | New: `*_create_whatsapp_connections.sql`, `*_add_whatsapp_connection_id_to_inbox_messages.sql` |
| RLS | Same migrations | Policies on `whatsapp_connections` only |
| Inbound | `supabase/functions/twilio-sms-webhook/index.ts` | Lookup by (AccountSid, To); set user_id, whatsapp_connection_id; no conv if no match |
| Outbound | `supabase/functions/inbox-twilio-send/index.ts` | JWT auth; load connection; decrypt; send; set user_id on message |
| Connect/Validate | New: `supabase/functions/whatsapp-connect/index.ts` (or similar) | Accept credentials; validate; encrypt; insert/update `whatsapp_connections` |
| Test | New: `supabase/functions/whatsapp-test/index.ts` (optional) | Send test message using user’s connection |
| Frontend – hooks | `src/modules/inbox/hooks/` | New: `useWhatsAppConnection`, `useWhatsAppConnect`, `useWhatsAppDisconnect`, `useWhatsAppTest` |
| Frontend – UI | `src/modules/inbox/components/` | New: `WhatsAppConnectionPanel.tsx`, `WhatsAppConnectionStatus.tsx` (or single component) |
| Layout | `src/app/layout/DashboardLayout.tsx` | Add WhatsApp status/entry next to Gmail |
| Types | `src/integrations/supabase/types.ts` (if generated) | Regenerate after migrations |

---

## Data flow (high level)

- **Connect:** Client submits Account SID, API Key SID, API Key Secret, WhatsApp From → Edge Function validates with Twilio → encrypt secret → insert/update `whatsapp_connections` (status = active/pending_validation). Secret never stored plaintext.
- **Inbound:** Twilio POST to `twilio-sms-webhook` with AccountSid, To, From, Body → lookup (AccountSid, To) → get user_id → find or create conversation with that user_id → insert message with user_id and whatsapp_connection_id → auto-link to customers by phone (existing attemptAutoLink).
- **Outbound:** Client POST to `inbox-twilio-send` with JWT, conversation_id, body_text → verify conversation.user_id = auth.uid() → load user’s active connection → decrypt secret → send via Twilio from whatsapp_from → insert outbound message with user_id.
- **Disconnect:** Client (or Edge Function) sets status = 'disconnected', optionally disconnected_at = now(). Inbound stops (no active row); outbound returns 403; history remains visible.

---

## Validation and error handling plan

- **Connect:** Validate Account SID, Key SID, Secret, From format (E.164 or whatsapp:+...). Call Twilio (e.g. balance or test send) before storing. On failure: set status = 'error', last_error = message; do not store invalid credentials.
- **Inbound:** If no matching connection: return 200 empty TwiML (do not create conversation). On DB errors: log; return 200 to avoid Twilio retries.
- **Outbound:** 400 if missing conversation_id or body_text; 401 if no/invalid JWT; 403 if no active connection; 404 if conversation not found or not owned; 502 on Twilio API failure; insert failed message row for audit when Twilio fails.
- **Frontend:** Toast or inline errors from Edge Function responses; disable buttons while loading; show last_error on connection row when status = 'error'.

---

## Testing plan

- **Unit / integration:** Edge Function tests (e.g. Deno test) for: connect validation, decrypt/send with mock Twilio; webhook lookup and user_id assignment (mock DB or in-memory).
- **E2E / manual:** Connect from UI with Sandbox credentials; send inbound (Twilio webhook simulator or real Sandbox); send outbound from inbox; disconnect; confirm history visible and send returns 403; Test button sends message.
- **Security:** Confirm secret never in client or logs; RLS prevents user A from reading user B’s connection.

---

## Rollout plan (Sandbox first, production later)

- **Sandbox:** Deploy migrations and Edge Functions; each user connects their own Twilio Sandbox credentials in Profile; webhook URL remains same (`twilio-sms-webhook`); routing by (AccountSid, To) supports multiple Sandbox numbers.
- **Production:** Same schema; users add production WhatsApp-enabled number as `whatsapp_from` (Replace flow); no code change; ensure Twilio webhook URL points to same Edge Function.
- **Compatibility:** Legacy env-based TWILIO_* can be removed once all traffic is per-user, or kept as fallback for one “global” Sandbox user during transition (document in quickstart).

---

## Risks and dependencies

- **Risks:** (1) Normalization mismatch between webhook `To` and stored `whatsapp_from` → no match, messages dropped. Mitigation: normalize both to same format (e.g. E.164) and document. (2) Encryption key loss → secrets unrecoverable. Mitigation: key in env; backup key securely. (3) Backfill: legacy conversations with user_id NULL stay hidden; decide if backfill to one user is needed.
- **Dependencies:** Supabase project env for encryption key; Twilio account (Sandbox or production) per user; frontend must send JWT to `inbox-twilio-send` (verify current client).

---

## Ambiguities to verify before implementation

1. **Status value:** Spec uses `'active'`; user said index `where status='connected'`. Decide one (recommend `'active'` to match gmail_connections).
2. **Column name:** User said `twilio_api_key_secret_enc` and `disconnected_at`. Spec has `twilio_api_key_secret_encrypted` and no disconnected_at. Use: `twilio_api_key_secret_encrypted` (or `twilio_api_key_secret_enc`); add `disconnected_at timestamptz` if desired for reporting.
3. **Companies table:** Confirm whether `public.companies` exists to add FK for `company_id`; else leave nullable without FK.
4. **Gmail insert policy:** Inbox tables: confirm whether client can INSERT (and set user_id) or only service role; affects whether webhook must use service role for inserts (already does).
5. **inbox-twilio-send auth:** Confirm how frontend calls it today (x-admin-token vs JWT); plan assumes we add JWT and optionally keep admin token for legacy.

---

*End of implementation plan.*
