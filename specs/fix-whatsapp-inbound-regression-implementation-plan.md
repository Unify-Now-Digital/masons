# Fix WhatsApp Inbound Regression — Implementation Plan

**Source of truth:** `specs/fix-whatsapp-inbound-regression.md`  
**Branch:** `feature/fix-whatsapp-inbound-regression` (or current branch)  
**Do not implement yet.** This document is the implementation plan only.

---

## 1. Goal and requirements (from spec)

- **Goal:** Restore inbound WhatsApp message receipt when the customer messages first (no existing conversation).
- **Root cause:** Connection lookup in `twilio-sms-webhook` uses exact equality between Twilio `To` and `whatsapp_connections.whatsapp_from`. Format differences cause no match → no conversation/message created.
- **Requirements:**
  1. Update only `supabase/functions/twilio-sms-webhook/index.ts`.
  2. Normalize WhatsApp connection lookup so Twilio `To` and stored `whatsapp_from` match in a canonical format.
  3. Keep conversation identity unchanged: `channel` = `'whatsapp'`, `primary_handle` = normalized customer number (no change).
  4. No frontend or schema changes unless strictly necessary.
  5. Preserve existing SMS behavior.
  6. Fix shared helper import to `../_shared/autoLinkConversation.ts`.
  7. Add logging when no connection is found for inbound WhatsApp.

---

## 2. Exact normalization rule for WhatsApp connection lookup

**Canonical form:** Compare using the **normalized E.164-style number only** (strip `whatsapp:` prefix and trim whitespace). Do **not** require a leading `+` for the comparison, so that `whatsapp:+44987654321`, `whatsapp:44987654321`, and stored `whatsapp:+44987654321` all match.

**Rule to implement:**

- **Normalize for comparison:**  
  `normalizeHandle(value) = (value ?? '').trim().replace(/^whatsapp:/i, '')`  
  - Trim, then remove a leading `whatsapp:` (case-insensitive) so that only the number part remains (e.g. `+44987654321` or `44987654321`).
- **Matching:** Two values match for connection lookup if and only if  
  `normalizeHandle(a) === normalizeHandle(b)`.
- **Where to use:** When resolving the WhatsApp connection, compare Twilio’s `To` with each connection’s `whatsapp_from` using this normalized form (see “Where in the webhook flow” below).

**SMS:** For SMS, the connection lookup does **not** use `whatsapp_connections` in the same way (SMS uses `to.trim()` for `toForConnection` only when `channel !== 'whatsapp'`). The WhatsApp-specific branch is the only one that queries `whatsapp_connections` by `whatsapp_from`. So applying the normalization **only** in the WhatsApp path (see below) keeps SMS behavior unchanged.

---

## 3. Exact file(s) to edit

| File | Purpose |
|------|--------|
| `supabase/functions/twilio-sms-webhook/index.ts` | Only file to change: connection lookup normalization, import path fix, and optional logging. |

No other files (no frontend, no migrations, no other functions).

---

## 4. Where in the webhook flow the change should happen

**Location:** Immediately after computing `channel`, `from`, `to` (around lines 40–42), and before the current connection query (lines 61–71).

**Current flow (problematic):**

1. Parse params, set `channel`, `from = normalizeHandle(rawFrom)`, `to = normalizeHandle(rawTo)`.
2. Set `toForConnection = channel === 'whatsapp' ? rawTo.trim() : to.trim()`.
3. Query: `whatsapp_connections` where `twilio_account_sid`, `whatsapp_from = toForConnection`, `status = 'connected'`.
4. If no row → return 200, no conversation/message.

**New flow:**

1. **Unchanged:** Parse params, set `channel`, `from`, `to` as today.
2. **WhatsApp only – resolve connection with normalized match:**
   - If `channel === 'whatsapp'`:
     - Query `whatsapp_connections` by `twilio_account_sid` and `status = 'connected'` (do **not** filter by `whatsapp_from` in the query).
     - Fetch rows (e.g. `select('id, user_id, whatsapp_from')`); if the table has multiple connections per account, fetch candidates and then in code find the one where `normalizeHandle(connection.whatsapp_from) === normalizeHandle(rawTo)`.
     - If exactly one such connection exists, set `connection`, `ownerUserId`, `connectionId` from it. If none or more than one match after normalization, treat as no match (and optionally log for “none”).
   - If `channel !== 'whatsapp'` (SMS):
     - Keep current behavior: do **not** query `whatsapp_connections` for SMS, or keep existing SMS path unchanged. (Current code uses `toForConnection = to.trim()` for SMS but then still queries `whatsapp_connections` with that value; if SMS is not expected to use `whatsapp_connections`, the existing logic for SMS may already return no connection. So only the **WhatsApp** branch should use the new normalized match. If in your codebase SMS also uses this same connection table, then for SMS keep the current equality check so SMS behavior is unchanged.)
3. **Unchanged:** If `!ownerUserId`, return 200 with empty TwiML (and add optional log for WhatsApp).
4. Rest of the handler unchanged: conversation lookup/insert, message insert, auto-link, response.

**Concrete placement:**

- Replace the block that sets `toForConnection` and runs the single `.eq('whatsapp_from', toForConnection)` query with:
  - For **WhatsApp:** query by `twilio_account_sid` and `status = 'connected'`, then in code select the connection where `normalizeHandle(connection.whatsapp_from) === normalizeHandle(rawTo)`.
  - For **SMS:** leave as today (e.g. if you still need a “connection” for SMS from this table, keep current `toForConnection = to.trim()` and existing query; otherwise no change to SMS path).
- Add optional log when `channel === 'whatsapp'` and `!ownerUserId` (e.g. log that no connection matched for WhatsApp, with normalized To and account SID, no secrets).

---

## 5. How to avoid breaking SMS lookup

- **Do not change the SMS branch.** Keep `toForConnection = to.trim()` when `channel !== 'whatsapp'` and keep the same query shape for SMS if it is used (e.g. same `.eq('whatsapp_from', toForConnection)` for SMS if that path is still required).
- **Apply normalized match only when `channel === 'whatsapp'`.** Use the “fetch by account + status, then filter in code by normalizeHandle(whatsapp_from) === normalizeHandle(rawTo)” pattern only for WhatsApp. SMS continues to use the current single-query equality so its behavior is preserved.
- **Do not change** `primary_handle`, `channel`, or any conversation/message fields; only the **connection resolution** for WhatsApp is made normalization-tolerant.

---

## 6. Verification steps

1. **Unit/behavior check (manual or script):**
   - Simulate Twilio POST with WhatsApp `To` in different formats (e.g. `whatsapp:+44987654321`, `whatsapp:44987654321`) with a single connection stored as `whatsapp:+44987654321`. Assert that in all cases the same connection is resolved and a conversation + message are created.
2. **Regression:** Simulate SMS inbound; assert connection and conversation/message behavior unchanged (if SMS uses this webhook).
3. **Import:** Deploy the function and confirm it loads (no missing module). Open a conversation and trigger an inbound WhatsApp message; confirm no runtime error and message appears in Inbox.
4. **Logs:** When no connection matches for WhatsApp, confirm a log line appears (e.g. “twilio-sms-webhook: no WhatsApp connection matched”, plus normalized To and account SID), and that no credentials are logged.

---

## 7. Manual test steps

1. **Setup:** Ensure one WhatsApp connection exists for the test account (`whatsapp_connections` with `twilio_account_sid`, `whatsapp_from` e.g. `whatsapp:+44987654321`, `status = 'connected'`).
2. **Customer messages first (no prior conversation):**
   - From the customer number, send an inbound WhatsApp message to the business number (so Twilio POSTs to the webhook with `From` = customer, `To` = business).
   - **Expected:** Message appears in Inbox under a new conversation; conversation has `channel = 'whatsapp'`, `primary_handle` = normalized customer number; connection used is the one above.
3. **Format tolerance (if possible):**
   - If Twilio or your test tool can send the same message with a different `To` format (e.g. without `+`), repeat; the same connection should still be found and the message should still appear.
4. **Web-started conversation still works:**
   - Start a WhatsApp conversation from the web app (New Conversation → WhatsApp → pick/enter customer). Send an inbound reply from that customer.
   - **Expected:** Reply appears in the same conversation; no regression.
5. **SMS (if applicable):**
   - Send an inbound SMS; confirm behavior unchanged (conversation/message created or not per current design).
6. **No connection:**
   - Use an account SID or `To` that does not match any connection; **expected:** 200 with empty TwiML, no conversation/message, and a log line indicating no WhatsApp connection matched (no secrets in log).

---

## 8. Summary checklist (for implementation phase)

- [ ] In `twilio-sms-webhook/index.ts`, for `channel === 'whatsapp'`, resolve connection by querying `whatsapp_connections` on `twilio_account_sid` and `status = 'connected'`, then in code selecting the row where `normalizeHandle(connection.whatsapp_from) === normalizeHandle(rawTo)`.
- [ ] Leave SMS path unchanged (same `toForConnection` and query as today when `channel !== 'whatsapp'`).
- [ ] Fix import to `'../_shared/autoLinkConversation.ts'`.
- [ ] When `channel === 'whatsapp'` and `!ownerUserId`, log a short message (e.g. “no WhatsApp connection matched”, normalized To, account SID; no credentials).
- [ ] Do not change conversation identity (`channel`, `primary_handle`) or any other webhook logic.
- [ ] Run verification and manual tests above before considering done.
