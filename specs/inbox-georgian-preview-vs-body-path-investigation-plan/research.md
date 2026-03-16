# Research: Stale Gmail body_text — preview vs thread path

**Source spec:** [inbox-georgian-preview-vs-body-path-investigation.md](../inbox-georgian-preview-vs-body-path-investigation.md)

## Findings

- **Card** uses `inbox_conversations.subject` and `inbox_conversations.last_message_preview` (conversation-level; preview from **latest** message).
- **Thread** uses `inbox_messages.body_text` per message (per-row; written once on insert, never updated on re-sync).
- **Gmail sync** in `gmail-sync-now/index.ts`: on duplicate Gmail message ID it **skips** (no UPDATE), so older rows keep stale/corrupted `body_text`.
- **Root cause:** Stale historical `body_text` in older `inbox_messages` rows; card can look correct because it shows the latest message’s preview.
- **Fix direction:** Backfill that re-fetches Gmail content and updates `body_text` (and `last_message_preview` when the message is the latest in its conversation); leave sync duplicate behavior unchanged.
