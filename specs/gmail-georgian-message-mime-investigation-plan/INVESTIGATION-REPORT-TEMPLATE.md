# Investigation report (one broken Georgian Gmail message)

Fill this after running gmail-sync-now with `GMAIL_DEBUG_MESSAGE_ID` set to the broken message's Gmail ID and reading the JSON log output.

## 1. Gmail message ID

- **Message ID:** (from Inbox UI or `inbox_messages.meta.gmail.messageId`)

## 2. From the diagnostic log (payload summary)

- **payload.mimeType:**
- **payload.body.data present?** (hasPayloadBodyData)
- **payload.parts:** (list each part's mimeType, hasBodyData, contentType, contentTransferEncoding; and nested parts if any)
- **Content-Type (top-level):**
- **Content-Transfer-Encoding (top-level):**

## 3. extractBodyText branch (from log)

- **Branch:** top-level-body | text/plain-part | nested-text/plain | none
- **bodyTextLength:**
- **bodyTextFromSnippet:** (true = current run used snippet as body_text)
- **snippetLength:**

## 4. Stored row (from log)

- **Row found?** yes / no
- **storedBodyTextLength:**
- **created_at:** (if row exists)
- **storedMatchesCurrentBody:**
- **storedMatchesSnippet:**

## 5. Root cause (conclusion)

- **Exact root cause for this message:**
  - [ ] Snippet fallback used (no text/plain / extractBodyText returned none)
  - [ ] Stale row (row predates fixes; duplicate skip so body_text never updated)
  - [ ] Wrong decoding (charset/encoding; branch was not none but text still corrupted)
  - [ ] Wrong part selected (branch is not the part that contains Georgian)
  - [ ] Other: ___

- **Exact file/function/branch:** gmail-sync-now/index.ts, extractBodyText → (branch) ; if snippet used, line 195 snippet fallback.

## 6. Recommended minimal fix

- [ ] **HTML fallback** — Add text/html fallback when no text/plain in extractBodyText.
- [ ] **Charset-aware decode** — Decode part body as UTF-8 (or Content-Type charset) after base64.
- [ ] **MIME part selection** — Change which part is chosen (e.g. prefer html when plain empty).
- [ ] **Snippet handling** — Do not store snippet when extractBodyText is none; store empty or add HTML fallback.
- [ ] **Backfill/resync** — Update existing rows for affected messages after improving extraction.

## 7. Old corrupted rows

- **Do existing corrupted rows need re-sync/backfill?** yes / no
- **Notes:**
