# WhatsApp Customer-First Early Return — Root Cause and Change List

## Overview

Narrowed regression: for a **brand-new customer number**, inbound WhatsApp creates **no** `inbox_conversations` row and **no** `inbox_messages` row. Existing WhatsApp conversations still receive replies. So the webhook is returning early before both inserts. This spec identifies the exact early-return path and the condition that causes it. **No implementation in this phase.**

**Context:**
- File: `supabase/functions/twilio-sms-webhook/index.ts`
- Customer-first = first message from a new number; no existing conversation

**Goal:**
- Find every return path before new conversation insert and message insert
- Identify which condition is hit for customer-first inbound WhatsApp
- Report exact root cause and exact change list

---

## 1. Every return path before new conversation insert and message insert

All returns that occur **before** the new-conversation insert (lines 161–176) and message insert (line 216):

| # | Line(s) | Condition | Returns |
|---|---------|-----------|--------|
| 1 | 20–21 | `req.method !== 'POST'` | 405 Method Not Allowed |
| 2 | 27–29 | Exception reading `req.text()` | 200 + empty TwiML |
| 3 | 43–48 | `!messageSid.trim() \|\| !from.trim() \|\| !to.trim()` | 400 JSON error |
| 4 | 52–55 | `!supabaseUrl \|\| !serviceRoleKey` | 200 + empty TwiML |
| 5 | **116–118** | **`!ownerUserId`** | **200 + empty TwiML** |
| 6 | 129–131 | `existingMsg` (message already in DB) | 200 + empty TwiML |

After return #5, the code never reaches:
- existing-conversation lookup
- new-conversation insert (when no existing conv)
- message insert

So for customer-first, **no** conversation and **no** message are created only if we hit one of 1–5. For a valid Twilio POST with a new customer, 1–4 are unlikely (method is POST, body readable, params present, env set). **Return #5 is the only one that explains “no new conversation, no new message” for customer-first.**

---

## 2. Condition most likely hit for customer-first inbound WhatsApp

**Return #5: `if (!ownerUserId)` at lines 116–118.**

- `ownerUserId` is set only when a **WhatsApp connection** is found: same Twilio account and a matching `whatsapp_from` (after normalization).
- If no connection row matches, `ownerUserId` stays `null`, the webhook returns 200 with empty TwiML, and no conversation or message is ever inserted.
- So the exact condition that causes no new conversation row and no new message row is: **no row in `whatsapp_connections` matches the inbound request**, i.e. the WhatsApp connection lookup fails, so `ownerUserId` remains `null` and the handler returns at 116–118.

---

## 3. Inspection of the path that sets ownerUserId

### detectChannel(rawFrom, rawTo)

- Uses `toLowerCase()` then `startsWith('whatsapp:')` on From/To.
- For Twilio inbound WhatsApp, From = customer, To = our number (often `whatsapp:+44...`). So channel is correctly `'whatsapp'` and this is not the cause.

### normalizeHandle(h)

- `(h ?? '').trim().replace(/^whatsapp:/i, '')` — strips optional `whatsapp:` prefix (case-insensitive) and trims.
- Does **not** normalize the **number** part (spaces, dashes, leading zeros, etc.). So:
  - Twilio might send `To: whatsapp:+44 123 456 7890` → normalized `"+44 123 456 7890"`.
  - DB might have `whatsapp_from: whatsapp:+441234567890` → normalized `"+441234567890"`.
  - String comparison fails: `"+44 123 456 7890" !== "+441234567890"`, so no match and `ownerUserId` stays null.

### WhatsApp connection lookup

- Query: `whatsapp_connections` where `twilio_account_sid = accountSid` and `status = 'connected'`.
- Match in code: `normalizeHandle(c.whatsapp_from) === normalizedTo` (where `normalizedTo = normalizeHandle(rawTo)`).
- So match is **string equality of normalized “To” and normalized stored `whatsapp_from`**. Any difference in formatting (spaces, dashes, etc.) prevents a match.

### ownerUserId assignment

- Set only when the above `find()` returns a match (lines 88–91). If no match, it stays `null` and we hit the return at 116–118.

---

## 4. Exact condition that causes no new conversation row and no new message row

- **Condition:** No row in `whatsapp_connections` (for the request’s `twilio_account_sid` and `status = 'connected'`) has `normalizeHandle(whatsapp_from) === normalizeHandle(rawTo)`.
- **Effect:** `ownerUserId` remains `null` → `if (!ownerUserId)` at 116–118 is true → `return new Response(twimlEmpty, ...)` → handler exits before:
  - existing-conversation lookup
  - new-conversation insert
  - message insert  
So: **no new `inbox_conversations` row and no new `inbox_messages` row.**

Likely reasons the match fails in practice:
1. **Phone number format mismatch:** Twilio’s `To` and stored `whatsapp_from` differ after current normalization (e.g. spaces, dashes). Current logic only strips the `whatsapp:` prefix and trims; it does not canonicalize digits.
2. **No connected row:** No `whatsapp_connections` row for this `twilio_account_sid` with `status = 'connected'`.
3. **Wrong account:** Twilio `AccountSid` in the request differs from the one stored (different project/env).

---

## 5. Findings summary

- **Early return that prevents both inserts:** `if (!ownerUserId)` at lines 116–118.
- **Root cause:** WhatsApp connection lookup fails (no matching `whatsapp_connections` row after normalized comparison), so `ownerUserId` is null and the handler returns before any conversation or message insert.
- **Likely driver:** Normalized comparison is strict string equality; number formatting differences (e.g. spaces in Twilio’s `To` vs no spaces in stored `whatsapp_from`) prevent a match.

---

## 6. Exact change list (no implementation yet)

1. **Normalize phone number for comparison (recommended)**  
   - In `twilio-sms-webhook/index.ts`, when matching WhatsApp connection, compare using a **digit-only** (or otherwise canonical) form of the number, not the full normalized string.  
   - Example: add a helper that strips non-digits (and optionally normalizes leading `+`/country code) from `normalizeHandle(handle)`, and match `normalizePhoneForMatch(connection.whatsapp_from) === normalizePhoneForMatch(rawTo)`.  
   - Ensures that `whatsapp:+44 123 456 7890` and `whatsapp:+441234567890` match.

2. **Diagnostics**  
   - When `!ownerUserId` after the WhatsApp branch, log (without secrets) that no connection matched and include: `channel`, `normalizedTo`, and whether any `whatsapp_connections` rows were returned for the account (e.g. count).  
   - Optionally log the normalized values of each `whatsapp_from` for that account to compare with `normalizedTo` and confirm format mismatch.

3. **No change to**  
   - Import path, `detectChannel`, existing-conversation or message-insert logic, or frontend/schema.

---

## What NOT to Do

- Do not change the early return at 116–118 (we still must not create conversations when there is no owning connection).
- Do not implement yet; this spec is analysis and change list only.
