# Gmail Shared Body Extractor — Decoder Regression Investigation

## Overview

**Goal:** Determine whether `_shared/gmailBody.ts` regressed body decoding (e.g. dropped UTF-8 / quoted-printable / header-aware logic) and is causing Georgian (and other non-ASCII) body text to remain corrupted for both old and new messages.

**Finding:** The shared extractor does **not** use any of the previously mentioned decoder helpers. Those helpers **do not exist** in this repository. The codebase has **never** contained `decodeBase64UrlToUtf8`, `decodePartBody`, `decodeQuotedPrintableToUtf8`, or header-aware decoding in the Gmail body path. The shared extractor is consistent with the original logic; the **gap** is that proper UTF-8 (and optional quoted-printable) decoding was never implemented here.

---

## 1. What _shared/gmailBody.ts does today

**File:** `supabase/functions/_shared/gmailBody.ts`

**Decoding logic:**

- For each candidate body (top-level `payload.body.data`, then `text/plain` parts and nested parts), it uses:
  - **Only:** `atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))`
- **Does not use:**
  - `decodeBase64UrlToUtf8`
  - `decodeBase64UrlToBytes`
  - `decodePartBody`
  - `decodeQuotedPrintableToUtf8`
  - `TextDecoder('utf-8')`
  - Part headers or `Content-Transfer-Encoding`
  - Charset from `Content-Type`

So the shared extractor uses **only** URL-safe base64 correction and `atob()`. It does **not** interpret the result as UTF-8 bytes and does **not** handle quoted-printable.

---

## 2. Presence of decoder modules

**Searched:** `supabase/functions` for files and references.

| Module / function              | Exists in repo? | Location |
|--------------------------------|-----------------|----------|
| `decodeBase64UrlToUtf8`        | **No**          | —        |
| `decodeBase64UrlToBytes`       | **No**          | —        |
| `decodePartBody`               | **No**          | —        |
| `decodeQuotedPrintableToUtf8` | **No**          | —        |
| `_shared/decodeBase64Utf8.ts`  | **No**          | —        |
| `_shared/decodePartBody.ts`    | **No**          | —        |
| `_shared/decodeQuotedPrintable.ts` | **No**     | —        |

**Conclusion:** There is no “newer” decoder implementation in this codebase to regress from. The spec and conversation referred to “UTF-8 base64 decode fix” and “quoted-printable support” as context; the actual Gmail body path has never used those here (they may exist in another branch or as planned work).

---

## 3. Why Georgian (and other non-ASCII) corrupt with current logic

- Gmail API returns body data as **base64url**.
- `atob()` decodes to a **binary string** (each character = one byte).
- In JavaScript, that string is often interpreted as **Latin-1** when indexing or displaying. UTF-8 multi-byte sequences (e.g. Georgian) are then misinterpreted → mojibake/corruption.
- **Correct approach:** Decode base64 → **bytes** (e.g. `Uint8Array`) → decode bytes with `TextDecoder('utf-8')` (or charset from part headers if needed). The current code never does the second step.

So the corruption is due to **missing** UTF-8 decoding, not to a regression from a previous implementation in this repo.

---

## 4. Who uses which extractor

| Consumer              | Source of body extraction                    | Decoding used |
|-----------------------|----------------------------------------------|---------------|
| **gmail-sync-now**    | Imports from `./gmailBody.ts` or `../_shared/gmailBody.ts` (path may vary by branch) | Same as shared: atob + URL-safe only |
| **gmail-refresh-body**| `../_shared/gmailBody.ts`                    | Same: atob + URL-safe only |
| **inbox-gmail-sync**  | **Own inline** `extractBodyText` (lines 242–272) | Same: atob + URL-safe only; does **not** use _shared |

- **gmail-sync-now** did **not** “lose” decoding by switching to shared: the shared extractor matches the original atob-only behavior.
- **gmail-refresh-body** uses the same simplified extractor, so it can only **rewrite** `body_text` with the same atob-only decoding. Running the backfill will not fix Georgian unless the shared extractor is upgraded first.

---

## 5. Exact “regression” vs “missing” behavior

- **Regression:** There is **no** regression in the sense of “code that used to do UTF-8/QP was removed.” The decoder modules and header-aware logic are not present in the repo.
- **Missing behavior in _shared/gmailBody.ts:**
  1. **UTF-8-safe base64 decode:** After base64url → binary, decode the **byte sequence** with `TextDecoder('utf-8')` (or charset from part/payload headers if we add header parsing).
  2. **Content-Transfer-Encoding:** If a part (or top-level) has `Content-Transfer-Encoding: quoted-printable`, decode that part with a quoted-printable decoder instead of (or in addition to) base64. Current code ignores this header.
  3. **Optional:** `text/html` fallback when no `text/plain` is available (strip tags or use first text node); and/or charset from `Content-Type` for non-UTF-8 parts.

---

## 6. Exact files and functions affected

| Role                         | File / location                                                                 |
|-----------------------------|---------------------------------------------------------------------------------|
| **Shared extractor**        | `supabase/functions/_shared/gmailBody.ts` — `extractBodyText()`, single decoding path for all bodies. |
| **Sync (per-user)**         | `supabase/functions/gmail-sync-now/index.ts` — uses shared (or local) `extractBodyText`; no other decoder. |
| **Backfill / refresh**      | `supabase/functions/gmail-refresh-body/index.ts` — uses `_shared/gmailBody.ts` only. |
| **Admin sync**              | `supabase/functions/inbox-gmail-sync/index.ts` — inline `extractBodyText`; same atob-only logic; does not use _shared. |

All of these currently produce body text with the same limited (atob-only) decoding, so all are affected by the same UTF-8 (and QP) gap.

---

## 7. Recommended minimal fix (consistent full decoder behavior)

- **Implement in one place:** `supabase/functions/_shared/gmailBody.ts`.
- **1) UTF-8-safe base64 decode**
  - Decode base64url to bytes, e.g. `Uint8Array.from(atob(urlSafeBase64), c => c.charCodeAt(0))`, then `new TextDecoder('utf-8').decode(bytes)`.
  - Use this for every place that currently does `atob(...)` on body data (top-level and parts).
- **2) Optional but recommended: quoted-printable**
  - If `Content-Transfer-Encoding` (from payload or part headers) is `quoted-printable`, decode the part body with a QP decoder (e.g. in `_shared/decodeQuotedPrintable.ts` or inline) and return that decoded string instead of base64 path.
  - Requires that `GmailPayload` (and part types) expose part headers; Gmail API payload and parts include `headers`.
- **3) Optional: charset from headers**
  - Read `Content-Type` (e.g. `charset=utf-8` or `charset=ISO-8859-1`) and use `TextDecoder(charset)` when present; default to `utf-8`.
- **4) Align inbox-gmail-sync**
  - Replace the inline `extractBodyText` in `inbox-gmail-sync/index.ts` with an import from `_shared/gmailBody.ts` so all three paths (gmail-sync-now, gmail-refresh-body, inbox-gmail-sync) share the same, improved decoding.

This gives “full current decoder behavior” in a single place and fixes Georgian (and other UTF-8) body text for both new syncs and refresh/backfill, without regressing any existing behavior (only adding correct decoding).

---

## 8. Summary

| Question | Answer |
|----------|--------|
| Did _shared/gmailBody.ts regress decoding? | **No.** It only ever used atob + URL-safe base64; no UTF-8/QP/header logic was removed. |
| Do decodeBase64UrlToUtf8 / decodePartBody / decodeQuotedPrintable exist? | **No.** They are not in the repo. |
| Did gmail-sync-now lose decoding by switching to shared? | **No.** Shared extractor matches the previous atob-only behavior. |
| Is gmail-refresh-body using the simplified extractor? | **Yes.** So backfill will not fix Georgian until the shared extractor is upgraded. |
| What is the minimal fix? | Add UTF-8-safe base64 decode (and optionally quoted-printable + charset from headers) in `_shared/gmailBody.ts`, and have `inbox-gmail-sync` use the shared extractor. |
