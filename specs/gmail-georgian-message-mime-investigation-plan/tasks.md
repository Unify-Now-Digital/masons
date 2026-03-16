# Tasks: Gmail Georgian message MIME investigation

## Implementation (done)

- [x] **Diagnostic logging in gmail-sync-now** — When env `GMAIL_DEBUG_MESSAGE_ID` equals the current message id, log a JSON report: payloadSummary (mimeType, hasPayloadBodyData, parts with mimeType, hasBodyData, contentType, contentTransferEncoding, nested), extractBodyTextBranch, bodyTextLength, bodyTextFromSnippet, snippetLength, and stored row (if any) with storedBodyTextLength, created_at, storedMatchesCurrentBody, storedMatchesSnippet.
- [x] **Branch helper** — `getExtractBodyTextBranch(payload)` returns which branch is used: top-level-body | text/plain-part | nested-text/plain | none.
- [x] **Report template** — `INVESTIGATION-REPORT-TEMPLATE.md` to fill after running the investigation.

**How to run:** Set Supabase Edge Function secret `GMAIL_DEBUG_MESSAGE_ID` to the Gmail message ID of the broken message (e.g. from `inbox_messages.meta.gmail.messageId`). Trigger gmail-sync-now (e.g. from Inbox or API). Read the function logs for the JSON report. Fill `INVESTIGATION-REPORT-TEMPLATE.md` from the log and conclude root cause and minimal fix.

## Phase 1 — Capture data for one broken message

- [ ] Identify one broken Georgian Gmail message (record Gmail message ID).
- [ ] Run gmail-sync-now with GMAIL_DEBUG_MESSAGE_ID set; fetch full payload is done by sync (format=full).
- [ ] From log: payload.mimeType, payload.body (data present?), payload.parts (and nested) with mimeType, headers (Content-Type, Content-Transfer-Encoding), body.data; message.snippet lengths.

## Phase 2 — Trace extraction and storage

- [ ] From log: extractBodyTextBranch (simulates which branch runs).
- [ ] From log: stored row body_text length, created_at; storedMatchesCurrentBody, storedMatchesSnippet.
- [ ] Conclude: snippet fallback used? row stale (created before fixes)?

## Phase 3 — Conclude and choose fix

- [ ] State exact root cause (snippet / wrong part / charset / old row / other).
- [ ] State exact file/function/branch that produced the stored body_text.
- [ ] Choose minimal fix: HTML fallback / charset-aware decode / resync-backfill / snippet handling / MIME part selection.
- [ ] Document recommended minimal fix and implement (separate implementation step).

## Phase 4 — Regression (after fix)

- [ ] Newly synced Georgian email: correct.
- [ ] Old corrupted message: correct after backfill if applicable.
- [ ] Plain-text and HTML-only and English: no regression.
- [ ] Non-Gmail channels: unaffected.
