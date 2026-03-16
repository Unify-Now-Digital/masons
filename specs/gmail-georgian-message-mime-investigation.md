# Gmail Georgian Message — Deep MIME Investigation (One Broken Message)

## Overview

**Context:** After (1) UI/font changes for Georgian, (2) a Gmail UTF-8 base64 decode fix, and (3) Gmail quoted-printable support, at least one email still shows corrupted Georgian text in `inbox_messages.body_text`. This spec defines how to deep-investigate **one** such affected message end-to-end to find the exact reason it remains corrupted.

**Goal:** For one currently broken Georgian email, determine why `body_text` is still wrong: trace from Gmail API payload → extraction logic → storage, and decide whether the next fix should be HTML fallback, charset-aware decode, resync/backfill, snippet handling, or MIME part selection.

---

## 1. Gmail payload structure to capture for the affected message

For the **one** broken message (identify by message ID or thread + subject/sender), capture:

- **payload.mimeType** — e.g. `multipart/alternative`, `text/html`, `text/plain`.
- **payload.body** — `size`, presence of **payload.body.data** (top-level inline body).
- **payload.headers** — full list; especially:
  - `Content-Type` (charset, boundary if multipart).
  - `Content-Transfer-Encoding` if at top level.
- **payload.parts[]** — for each part:
  - **mimeType** (e.g. `text/plain`, `text/html`).
  - **headers** (Content-Transfer-Encoding, Content-Type with charset).
  - **body.size**, **body.data** (presence/absence).
- **Nested parts** — if any `part.parts` (e.g. under `multipart/alternative`), same structure for each nested part.
- **message.snippet** — Gmail’s snippet for this message (may be used as fallback when no body is extracted).

From this we can see: (a) whether the message has a `text/plain` part, (b) whether it is HTML-only, (c) which part has the Georgian content, (d) charset and transfer encoding of each part.

---

## 2. Which part is selected by extractBodyText today

**Relevant code:**

- **gmail-sync-now** (per-user inbox sync): `supabase/functions/gmail-sync-now/index.ts`, function `extractBodyText` (lines 34–63).
- **inbox-gmail-sync** (admin inbox sync): `supabase/functions/inbox-gmail-sync/index.ts`, inline `extractBodyText` (lines 242–272).

**Current selection order:**

1. **Top-level body:** if `payload.body?.data` exists, decode with `atob(urlSafeBase64)` and return; no Content-Transfer-Encoding or charset handling.
2. **First text/plain part:** loop `payload.parts`; first part with `mimeType === 'text/plain'` and `part.body?.data`; same atob decode; return.
3. **First nested text/plain:** if a part has `part.parts`, loop and pick first nested `mimeType === 'text/plain'` with `body?.data`; same decode; return.
4. **No text/html fallback** in either function — if the message has only `text/html`, both return `''`.

**For the broken message, answer:** Was the stored `body_text` produced from (A) top-level `payload.body.data`, (B) a top-level `text/plain` part, (C) a nested `text/plain` part, or (D) none of the above (so fallback to snippet)?

---

## 3. What is stored in inbox_messages.body_text for this message

- **Query** the row for this message (e.g. by `meta->gmail->messageId` or by thread + sent_at / from_handle).
- **Check:** Is `body_text` (a) a decoded body from one of the parts above, (b) exactly or approximately equal to `message.snippet`, or (c) an old/corrupted value (e.g. from before any UTF-8 or QP fixes, or from a previous sync that used snippet)?
- **Compare:** If you have the raw Gmail payload for this message, compare `body_text` to:
  - The decoded `payload.body.data` (if present).
  - The decoded first `text/plain` part (if present).
  - The decoded first `text/html` part (if present).
  - The `message.snippet`.
- This tells us whether the corruption is from (i) wrong part chosen, (ii) wrong decoding (charset/encoding), (iii) snippet fallback, or (iv) stale data.

---

## 4. Message-specific checks (this one broken message)

Answer for this message:

- **No text/plain part?** — If the message has only `text/html`, `extractBodyText` returns `''` and the code uses `message.snippet`; snippet may be truncated or not UTF-8-safe for Georgian.
- **Only text/html?** — Same as above; no HTML fallback in current inbox sync.
- **multipart/alternative?** — Common: one part `text/plain`, one `text/html`. If `text/plain` is missing or has no `body.data` (e.g. only HTML has data), we get no body and fall back to snippet.
- **Charset in Content-Type not utf-8?** — Current code does not read headers or charset; it uses `atob()` and treats the result as a string. If the part is UTF-8, in JS the binary string from `atob` should be decoded with a UTF-8 decoder (e.g. `TextDecoder`); otherwise multi-byte characters (e.g. Georgian) can be wrong. If the part is another charset (e.g. ISO-8859-1), we would need charset-aware decode.
- **Quoted-printable on HTML but not plain?** — Current code does not handle Content-Transfer-Encoding; it only does base64. If the chosen part is base64, QP is irrelevant for that part. If the only part with content is QP-encoded and we are not decoding QP, we might be using the wrong part or wrong decoding.
- **Broken snippet from Gmail?** — If we fall back to `message.snippet`, Gmail may return a snippet that is truncated, HTML-stripped, or differently encoded, which could look corrupted for Georgian.

---

## 5. Whether the message was newly synced after recent fixes

- **If the row was created/updated after** the UTF-8 base64 and quoted-printable fixes: the bug is in current extraction or part selection (e.g. no HTML fallback, wrong part, or missing charset/decoding).
- **If the row was never replaced** (e.g. sync skips “duplicate” by Gmail message ID and does not update body_text): then the stored value may be historical. Fix would be to either (a) update existing rows when we improve extraction, or (b) force a resync for affected messages (backfill).

Check: creation/update time of the `inbox_messages` row vs deployment time of the last Gmail sync fix; and whether the sync logic updates existing messages or only inserts new ones.

---

## 6. Exact files and code areas responsible

| File | Function / area | Role |
|------|------------------|------|
| **supabase/functions/gmail-sync-now/index.ts** | `extractBodyText` (lines 34–63) | Picks top-level body or first text/plain (top-level or nested); atob only; returns '' if none. |
| **supabase/functions/gmail-sync-now/index.ts** | Line 194–195 | `bodyText = extractBodyText(...)`; if empty, `bodyText = message.snippet`. |
| **supabase/functions/gmail-sync-now/index.ts** | Line 253 | `body_text: bodyText` stored in `inbox_messages`. |
| **supabase/functions/inbox-gmail-sync/index.ts** | `extractBodyText` (lines 242–272) | Same logic as gmail-sync-now. |
| **supabase/functions/inbox-gmail-sync/index.ts** | Lines 275–276, 357 | Same snippet fallback and `body_text` storage. |

No Content-Transfer-Encoding (quoted-printable) or charset handling in these paths. No text/html fallback.

---

## 7. Root cause (to be filled by investigation)

After inspecting the one message, state:

- **Exact root cause** for this specific still-broken message (e.g. “HTML-only message; extractBodyText returns ''; body_text is snippet” or “text/plain part has charset X and we don’t decode it” or “row predates fixes and was never updated”).
- **Exact file/function/branch** that produced the stored `body_text` (e.g. gmail-sync-now, extractBodyText → snippet fallback at line 195).

---

## 8. Next fix type (choose one or combine)

Based on the investigation, decide whether the next fix should be:

- **HTML fallback** — When there is no text/plain (or no body from it), use the first `text/html` part and strip tags or store HTML for the UI that already renders HTML; so Georgian in HTML is not lost.
- **Charset-aware decode** — After base64 (and QP if present), decode the byte sequence using Content-Type charset (e.g. UTF-8 via `TextDecoder`) so multi-byte scripts render correctly.
- **Historical resync/backfill** — If the row is old and we don’t update existing messages on sync, add a backfill (or one-off script) that re-fetches this message and updates `body_text` with improved extraction.
- **Snippet handling change** — If we must use snippet, ensure we do not store it when it’s known to be bad (e.g. prefer empty or a placeholder), or improve how Gmail snippet is requested/decoded if possible.
- **MIME part selection change** — If the correct part is present but we’re not selecting it (e.g. wrong order, or we should prefer a different part when plain is empty), adjust the selection order or add conditions.

---

## 9. Recommended minimal fix

After the investigation, recommend **one** minimal fix (or a short ordered list):

- E.g. “Add text/html fallback in extractBodyText in gmail-sync-now and inbox-gmail-sync; when no text/plain with data, use first text/html part and decode with atob (and UTF-8 decode if needed).”
- Or “Add UTF-8 decode step after atob for all parts (TextDecoder); then re-sync or backfill affected messages.”
- Or “Do not store snippet when extractBodyText returns ''; store empty or re-fetch with full format and HTML fallback.”

The recommendation should be scoped to the root cause found for this one message and generalized only where it clearly applies to other similar messages.
