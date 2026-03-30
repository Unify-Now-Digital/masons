# Gmail Georgian Message MIME Investigation — Implementation Plan

## 1. Root-cause investigation workflow

Execute in order:

1. **Identify one broken message** — Pick one Gmail message that still shows corrupted Georgian in the Inbox (e.g. by conversation + sender + subject or by opening the thread and noting the message). Record its **Gmail message ID** (from UI, URL, or DB: `inbox_messages.meta->gmail->messageId`).

2. **Fetch Gmail API payload for that message** — Use Gmail API `messages.get(id, format='full')` (or equivalent) for that message ID. Save the full response (or at least `payload`, `snippet`, `id`, `threadId`). This can be done via a one-off script, Postman, or existing admin tooling if available.

3. **Inspect what extractBodyText would choose** — Walk the payload manually against the logic in `gmail-sync-now/index.ts` (lines 34–63): (a) Is `payload.body?.data` present? (b) If not, which part in `payload.parts` is the first with `mimeType === 'text/plain'` and `part.body?.data`? (c) If none, is there a nested `part.parts` with text/plain + body.data? (d) If none of the above, extractBodyText returns `''` and the sync uses `message.snippet`. Record which branch would run (top-level body / top-level text/plain / nested text/plain / none → snippet).

4. **Inspect stored inbox_messages.body_text** — Query `inbox_messages` for this message (e.g. `WHERE meta->gmail->>messageId = '<id>'` or by conversation_id + channel = 'email' and match on sent_at/from). Read `body_text`. Compare to: (a) decoded `payload.body.data` (if present), (b) decoded first text/plain part, (c) decoded first text/html part, (d) `message.snippet`. Determine whether body_text equals one of these (or a truncated/corrupted version).

5. **Confirm snippet fallback** — If body_text matches or closely matches snippet (e.g. same length, same start), snippet fallback was used. If it matches a decoded part but is corrupted, the issue is decoding (charset/encoding). If it matches nothing and looks like old mojibake, the row may be historical.

6. **Confirm whether row is old or newly synced** — Check `inbox_messages` row: created_at / updated_at (if the table has it). Compare to when the UTF-8 base64 and quoted-printable fixes were deployed. Confirm whether sync logic updates existing rows: in gmail-sync-now and inbox-gmail-sync, duplicate is detected by Gmail message ID and the code **skips** (does not update body_text). So if the row existed before the fix, body_text was never replaced.

---

## 2. Exact places/files to inspect

| Location | What to inspect |
|----------|------------------|
| **supabase/functions/gmail-sync-now/index.ts** | `extractBodyText` (lines 34–63): selection order, atob-only decode, no QP/charset. Lines 194–195: snippet fallback. Line 253: body_text write. Duplicate check: no update of existing row. |
| **supabase/functions/inbox-gmail-sync/index.ts** | Same: `extractBodyText` (242–272), snippet fallback (275–276), body_text (357). Duplicate check: skip, no update. |
| **Admin/debug tooling or logs** | Any script or dashboard that calls Gmail API or logs message payloads; Supabase function logs for gmail-sync-now/inbox-gmail-sync (if payload or body_text are logged). |
| **Database** | Table `inbox_messages`: column `body_text`, `meta` (gmail.messageId, gmail.threadId), and any created_at/updated_at if present. Query by `meta->gmail->>messageId` or by conversation + channel = 'email'. |

---

## 3. Data to capture for the broken message

For the **one** broken message, record:

| Field | Where | Purpose |
|-------|--------|---------|
| **Gmail message id** | API response `id` or DB `meta.gmail.messageId` | Identify the message. |
| **message.snippet** | Gmail API `messages.get` response | Compare to body_text; detect snippet fallback. |
| **payload.mimeType** | `payload.mimeType` | e.g. multipart/alternative, text/html. |
| **payload.body** | `payload.body` (size, data) | Top-level inline body present? |
| **payload.headers** | `payload.headers` | Content-Type (charset, boundary), Content-Transfer-Encoding. |
| **payload.parts** | `payload.parts[]` | Length; for each: mimeType, headers, body.size, body.data (present/absent). |
| **Nested parts** | `part.parts[]` | Same for nested (e.g. under multipart/alternative). |
| **Content-Type charset** | From part or payload headers | e.g. utf-8, iso-8859-1. |
| **Content-Transfer-Encoding** | From part or payload headers | base64, quoted-printable, 7bit. |
| **Decoded top-level body** | atob(payload.body.data) if present | Compare to body_text. |
| **Decoded first text/plain** | atob(part.body.data) for first text/plain part | Compare to body_text. |
| **Decoded first text/html** | atob(part.body.data) for first text/html part | Compare to body_text; assess HTML fallback value. |
| **Stored body_text** | inbox_messages.body_text | Compare to above. |
| **Row created/updated** | If available | Old vs newly synced. |

---

## 4. Decision tree for likely outcomes

```
extractBodyText returns non-empty?
├─ YES → Stored body_text from decoded part
│   ├─ body_text matches decoded part but still corrupted
│   │   → Likely: charset/encoding (e.g. UTF-8 not applied after atob, or QP not decoded).
│   │   Fix: charset-aware decode (and QP if that part is QP).
│   └─ body_text does not match any decoded part
│       → Likely: wrong part selected or stale row.
│       Fix: MIME part selection change and/or resync/backfill.
└─ NO → Snippet fallback used
    ├─ body_text equals (or ≈) snippet
    │   → Snippet is corrupted or truncated for Georgian.
    │   Fix: HTML fallback when no text/plain (so we don’t store snippet for this case), or snippet handling change.
    └─ body_text is old/corrupted and not snippet
        → Row predates fixes; never updated (duplicate skip).
        Fix: resync/backfill for this message (and similar).
```

**Encoding header on different MIME level** — If the part we use is base64 and the Content-Transfer-Encoding is on the part (or parent), we already decode base64. If the part is quoted-printable and we don’t decode QP, that would cause wrong text; then fix is QP decode for that part. If charset is on Content-Type of the part and we don’t use it, fix is charset-aware decode after base64 (and QP if applicable).

---

## 5. Minimal-fix recommendation paths (depending on what is found)

| Finding | Recommended minimal fix |
|---------|-------------------------|
| **HTML-only / no text/plain** | Add **text/html fallback** in extractBodyText (gmail-sync-now + inbox-gmail-sync): when no text/plain with data, use first text/html part; decode with atob; optionally strip tags for plain storage or store HTML and let UI render it. |
| **Charset not applied (UTF-8 or other)** | Add **charset-aware decode** after atob: e.g. new TextDecoder('utf-8').decode(Uint8Array from binary string); if Content-Type has charset, use it. |
| **Old corrupted row never updated** | **Resync/backfill**: one-off script or migration that re-fetches affected messages (e.g. by message ID list or by “email channel + created before date”) and updates inbox_messages.body_text with improved extraction. Optionally change sync to update existing row when body extraction improves. |
| **Snippet used and snippet is bad** | **Snippet handling**: when extractBodyText returns '', either (a) store empty or placeholder and prefer “no body” in UI, or (b) add HTML fallback so we rarely need snippet for HTML-only messages. |
| **Wrong MIME part selected** | **MIME part selection change**: adjust order or conditions (e.g. prefer part with charset utf-8, or choose text/html when text/plain is empty and HTML exists). |

---

## 6. Recommended quickest path (confirm with least code change first)

1. **No code change** — Manually for one message: (a) Get Gmail message ID from DB or UI. (b) Call Gmail API `messages.get(id, format='full')`. (c) In a spreadsheet or text file, write: payload.mimeType; presence of payload.body.data; list of payload.parts (mimeType, has body.data). (d) Simulate extractBodyText: which branch returns (top-level / text/plain / nested / none)? (e) Query inbox_messages for that messageId; compare body_text to snippet and to decoded parts (decode in browser console or small script).  
   **Outcome:** You know whether it’s snippet fallback, wrong part, bad decode, or old row.

2. **If snippet fallback** — Add **HTML fallback** in extractBodyText (both sync functions): after text/plain branches, if still empty, take first part with mimeType === 'text/html' and part.body?.data, atob, return. Optionally strip HTML for plain storage or keep HTML (UI already supports it). Deploy and re-sync that thread (or backfill that message) to verify.

3. **If old row** — Run a one-off backfill for that message ID: fetch from Gmail, re-run extraction (with any new fallback), UPDATE inbox_messages SET body_text = ... WHERE meta->gmail->>messageId = '<id>'. No change to sync logic required for the fix to apply to that row.

4. **If charset/encoding** — Add UTF-8 decode (and QP if needed) in the same extractBodyText path; then backfill or re-sync the message.

---

## 7. Regression checklist for the eventual fix

After implementing the chosen minimal fix, verify:

| Check | Expected |
|-------|----------|
| **Newly synced Georgian email** | New message with Georgian in body (plain or HTML) shows correct script in Inbox. |
| **Old corrupted message** | After backfill or re-sync, the previously broken message shows correct Georgian (if fix includes backfill). |
| **Plain-text email** | Email with only text/plain part still extracts and displays correctly. |
| **HTML-only email** | Email with only text/html part now gets body from HTML (if HTML fallback added) and displays correctly. |
| **English email** | English-only messages unchanged; no regression. |
| **Non-Gmail channels** | SMS/WhatsApp and other channels unaffected; no change to twilio-sms-webhook or other sync paths. |
