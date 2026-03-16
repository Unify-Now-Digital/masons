# Fix WhatsApp Inbound Regression — Tasks

**Spec:** `specs/fix-whatsapp-inbound-regression.md`  
**Plan:** `specs/fix-whatsapp-inbound-regression-implementation-plan.md`

## Phase 1: Webhook connection lookup and import

- [ ] **1.1** Fix shared helper import in `supabase/functions/twilio-sms-webhook/index.ts`: change `'./autoLinkConversation.ts'` to `'../_shared/autoLinkConversation.ts'`.
- [ ] **1.2** For WhatsApp only: replace exact `whatsapp_from = toForConnection` query with: query `whatsapp_connections` by `twilio_account_sid` and `status = 'connected'`, then in code pick the connection where `normalizeHandle(connection.whatsapp_from) === normalizeHandle(rawTo)` (use existing `normalizeHandle`; ensure it strips `whatsapp:` case-insensitively if needed).
- [ ] **1.3** Leave SMS path unchanged: when `channel !== 'whatsapp'`, keep current `toForConnection` and existing query logic.
- [ ] **1.4** When `channel === 'whatsapp'` and no connection matched (`!ownerUserId`), add a short log (e.g. "twilio-sms-webhook: no WhatsApp connection matched", normalized To, account SID; no credentials).

## Phase 2: Verification and tests

- [ ] **2.1** Run verification steps from implementation plan (normalized match for different To formats, SMS regression, import load, logs).
- [ ] **2.2** Run manual test steps: customer messages first, web-started conversation reply, optional format tolerance, no-connection log.

## Done

- [ ] All tasks above completed; no frontend or schema changes.
