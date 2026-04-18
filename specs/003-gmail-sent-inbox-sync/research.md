# Research: Gmail Sent sync (003-gmail-sent-inbox-sync)

## 1. Thread matching when `external_thread_id` is null everywhere

**Decision**: Run a **one-time backfill** on `inbox_conversations` setting `external_thread_id` from an existing email message’s `meta.gmail.threadId` for that conversation, then match SENT imports by equality on `external_thread_id` and Gmail thread id.

**Rationale**: `inbox_conversations` has **no `meta` column**; the thread id already lives on messages. Storing canonical thread id on the conversation row matches future lookups and avoids scanning JSON in the hot path.

**Alternatives considered**:

- Match only via `inbox_messages.meta` subquery at sync time — high cost and awkward for “find conversation” per message.
- Add `meta` to conversations — redundant with `external_thread_id` and broader churn.

## 2. Deduplication without a reliable unique index today

**Decision**: **Backfill** `inbox_messages.external_message_id` from `meta->'gmail'->>'messageId'` for email rows, then enforce **uniqueness** per channel + connection + external id (see migration DDL). New inserts always set `external_message_id` to the Gmail message id string.

**Rationale**: JSON-path-only dedupe cannot use a simple constraint; a dedicated column matches existing Twilio/SMS patterns and supports fast lookups.

**Alternatives considered**:

- Unique index on expression `(meta->'gmail'->>'messageId')` — works but keeps dedupe off the canonical column and complicates queries.
- Rely on pre-insert SELECT only — race-prone under concurrent syncs; unique constraint is the backstop.

## 3. INBOX vs SENT processing shape

**Decision**:

- **INBOX**: Keep **thread expansion** and header-based **direction** (inbound vs outbound) for messages that appear in Inbox.
- **SENT**: Process listed SENT messages with **forced outbound** direction, **conversation match** by `external_thread_id`, **no** new conversation creation for orphans in v1 (**skip + log**).

**Rationale**: Aligns with product choice to defer “sent-only new thread” handling; INBOX path preserves current behaviour for mixed threads.

**Alternatives considered**:

- Full thread fetch for every SENT list row — expensive; list + per-message fetch + match is enough if thread id suffices.
- Create conversation from SENT-only — explicitly out of scope for first release (see spec open questions).

## 4. Deploy ordering

**Decision**: **Migrations first** (backfill + indexes), then **Edge Function** deploy.

**Rationale**: Sync code will rely on populated `external_thread_id` and unique `external_message_id`; deploying functions first yields no matches and possible duplicate rows.

**Alternatives considered**: Feature flag two-phase deploy — valid for large orgs; default is sequential migration → function.
