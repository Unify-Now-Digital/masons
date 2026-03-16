# Fix WhatsApp Inbound Regression — Inbound Messages Not Received Unless Conversation Started from Web

## Overview

This spec analyses the regression where **inbound WhatsApp messages do not appear in Inbox when the customer messages first** (no existing conversation). If the conversation is started from the web app first, inbound replies appear as expected. The likely affected code is `supabase/functions/twilio-sms-webhook/index.ts`. This document captures the full inbound flow, compares handle/channel formats between web-created and webhook-created conversations, identifies the root cause, and lists the exact change list. **No implementation is done in this phase.**

**Context:**
- Inbox auto-linking was recently refactored into a shared helper; email linking is fixed; WhatsApp linking had been working.
- The webhook routes inbound Twilio (SMS/WhatsApp) to an owner via `whatsapp_connections` and then finds or creates `inbox_conversations` and inserts `inbox_messages`.
- If the webhook does not find a connection or fails to create/insert, it returns 200 without creating data, so the message never appears in Inbox.

**Goal:**
- Identify the exact root cause (lookup mismatch, handle normalization, channel mismatch, failed insert, or auto-link side effect).
- Produce a precise change list so the fix can be implemented in a follow-up phase.

---

## Current State Analysis

### Inbound WhatsApp Flow in `twilio-sms-webhook/index.ts`

**File:** `supabase/functions/twilio-sms-webhook/index.ts`

**1. Reading From / To**
- `rawFrom = params.get('From') ?? ''`
- `rawTo = params.get('To') ?? ''`
- Twilio sends form-urlencoded body; for WhatsApp, `From` is the customer number (e.g. `whatsapp:+441234567890`), `To` is the business number (e.g. `whatsapp:+449876543210`).

**2. Deriving channel (sms vs whatsapp)**
- `detectChannel(rawFrom, rawTo)`: returns `'whatsapp'` if either `rawFrom` or `rawTo` starts with `'whatsapp:'`, else `'sms'`.

**3. Deriving primary_handle**
- `normalizeHandle(h) = (h ?? '').trim().replace(/^whatsapp:/, '')`
- `from = normalizeHandle(rawFrom)` → e.g. `+441234567890`
- `to = normalizeHandle(rawTo)` → e.g. `+449876543210`
- `primaryHandle = from.trim()` → used for **conversation lookup and new conversation insert** (customer identifier).

**4. Looking up existing conversations**
- Query: `inbox_conversations` where `channel`, `primary_handle` (= `from.trim()`), `status = 'open'`, `user_id = ownerUserId`.
- So lookup uses **normalized** customer number (no `whatsapp:` prefix).

**5. Inserting new inbox_conversations**
- When no existing conversation: insert with `channel`, `primary_handle: primaryHandle` (normalized), `external_thread_id`, `user_id: ownerUserId`, etc.
- So webhook-created conversations store **normalized** `primary_handle` (e.g. `+441234567890`).

**6. Inserting inbox_messages**
- After resolving or creating `conversationId`, insert `inbox_messages` with `conversation_id`, `channel`, `from_handle: from.trim()`, `to_handle: to.trim()`, etc. Non-fatal errors are logged; success path returns 200.

**7. Connection lookup (gate before any conversation/message logic)**
- `toForConnection = channel === 'whatsapp' ? rawTo.trim() : to.trim()`
- For WhatsApp, this is **raw `To`** (e.g. `whatsapp:+449876543210`).
- Query: `whatsapp_connections` where `twilio_account_sid = accountSid`, `whatsapp_from = toForConnection`, `status = 'connected'`.
- If **no connection is found**, the webhook returns `twimlEmpty` with 200 **without** creating a conversation or message (lines 76–78). So the message never appears in Inbox.

**8. Auto-link**
- After conversation and message insert/update, `attemptAutoLink(supabase, conversationId, channel, from.trim())` is called. It does not block or remove messages; it only sets `person_id` / `link_state`. The regression (message not showing) is therefore **not** caused by the auto-link helper.

---

### Comparison: Web-Created vs Webhook-Created WhatsApp Conversations

| Aspect | Web-created (NewConversationModal → createConversation) | Webhook-created (twilio-sms-webhook else branch) |
|--------|--------------------------------------------------------|--------------------------------------------------|
| **channel** | `'whatsapp'` | `channel` (derived as `'whatsapp'`) |
| **primary_handle** | From UI: customer phone, trimmed, spaces removed; **no `whatsapp:` prefix** (e.g. `+441234567890` or `441234567890`) | `primaryHandle = from.trim()` = `normalizeHandle(rawFrom)` = **no `whatsapp:` prefix** (e.g. `+441234567890`) |
| **user_id** | Logged-in user | `ownerUserId` from `whatsapp_connections` |

So for **conversation** identity (channel + primary_handle + user_id), web and webhook both use **normalized** customer number (no prefix). There is **no** handle normalization mismatch between web-created and webhook-created conversations for the **conversation lookup** or **insert** path.

---

### Where the Regression Comes From: Connection Lookup

- The only gate that **prevents** the webhook from creating a conversation and message is the **connection lookup** (lines 64–78).
- For WhatsApp, the webhook matches the connection using:
  - `whatsapp_from = toForConnection`
  - `toForConnection = rawTo.trim()` (e.g. `whatsapp:+449876543210`).
- So the match is an **exact string** comparison between Twilio’s `To` and `whatsapp_connections.whatsapp_from`.

**When this fails:**
- If Twilio sends `To` in a **different format** than what is stored in `whatsapp_from` (e.g. `whatsapp:449876543210` without `+`, or with different spacing/casing), the `.eq('whatsapp_from', toForConnection)` returns no row.
- Then `ownerUserId` is null, the webhook returns 200 with empty TwiML, and **no conversation or message is created** — so the inbound message never appears in Inbox.

**Why “start from web first” works:**
- When the user starts a conversation from the web, they only create an `inbox_conversations` row; the **connection** was already found and used when the **first inbound reply** arrived (same `To` / same account). So the connection lookup is not re-tested in a different way; the point is that for “customer messages first” there is **no** prior conversation, and the **only** way the message can appear is if the webhook creates it — which it only does after a successful connection lookup. So if the connection lookup fails (e.g. format mismatch), “customer messages first” will never show.

**Stored format of whatsapp_from:**
- `whatsapp-connect` stores `whatsapp_from` via `normalizeWhatsAppFrom(fromRaw)`, which **adds** the `whatsapp:` prefix if missing and expects E.164. So the DB typically has `whatsapp:+44...`. If Twilio’s `To` ever differs (e.g. no `+`, or different normalization), the exact match fails.

---

## Root Cause

**Exact root cause:**  
Inbound WhatsApp messages do not appear when the customer messages first because the **whatsapp_connections** lookup in `twilio-sms-webhook` uses **exact string match** of Twilio’s `To` to `whatsapp_connections.whatsapp_from`. If Twilio sends `To` in a different format than what was stored at connection time (e.g. E.164 variant, missing `+`, or whitespace), the lookup returns no row. The webhook then returns 200 without creating a conversation or message, so the message never shows in Inbox.

**Not caused by:**
- Conversation lookup or insert (primary_handle/channel are consistent and normalized).
- Message insert logic (runs only after connection is found).
- Auto-link helper (only updates link state; does not prevent message creation).
- Handle format for **conversation** identity (web and webhook both use normalized customer number).

---

## Exact Change List

1. **Normalize connection lookup for WhatsApp (primary fix)**  
   **File:** `supabase/functions/twilio-sms-webhook/index.ts`  
   - For WhatsApp, do **not** rely on exact `whatsapp_from = rawTo`. Either:
     - **Option A:** Query `whatsapp_connections` by `twilio_account_sid` and `status = 'connected'`, then in code select the connection where `normalizeHandle(connection.whatsapp_from) === normalizeHandle(rawTo)` (so both sides are compared in the same normalized form), or  
     - **Option B:** Ensure a single canonical normalization (e.g. E.164 with `whatsapp:` prefix) and apply it to both `rawTo` and stored `whatsapp_from` before comparison.  
   - Use the chosen normalization consistently so that small format differences from Twilio do not cause the lookup to fail.

2. **Verify/fix auto-link import**  
   **File:** `supabase/functions/twilio-sms-webhook/index.ts`  
   - Current import is `from './autoLinkConversation.ts'`; the shared module lives at `_shared/autoLinkConversation.ts`. Ensure the import path is `'../_shared/autoLinkConversation.ts'` so the function loads correctly. If a local `./autoLinkConversation.ts` was removed in the refactor, the wrong path would prevent the function from loading or cause runtime errors.

3. **Optional: Log when connection is not found**  
   - When `!ownerUserId` after the connection query, log a short message (e.g. accountSid, normalized To, and that no connection matched) so future format mismatches are easier to diagnose. Do not log full credentials.

4. **No frontend or schema changes required** for this regression; conversation and message shape are already correct when the webhook creates them.

---

## What NOT to Do

- Do not change the format of `primary_handle` for conversations (it must remain normalized without `whatsapp:` for consistency with the web and with auto-link).
- Do not remove or relax the connection lookup; only make the match resilient to format variation.
- Do not implement in this phase; this spec is analysis and change list only.

---

## Open Questions / Considerations

- Confirm in production or staging logs whether the webhook is invoked for “customer messages first” and whether the connection query returns no row (would support the format-mismatch hypothesis).
- If desired, add a small test that simulates Twilio POST with different `To` formats and asserts the same connection is found after normalization.
