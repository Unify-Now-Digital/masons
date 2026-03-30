# Data model — unlinked pseudo-customers (logical)

## No new tables

- **Linked customer:** `customers` / `person_id` on `inbox_conversations` (existing).
- **Unlinked pseudo-customer:** logical group = subset of `inbox_conversations` where:
  - `user_id` = current user (RLS)
  - `status` = `open` (match current Customers timeline)
  - `person_id` IS NULL
  - same `channel` and same `primary_handle` (exact string)

## AI summaries table extension

**Table:** `public.inbox_ai_thread_summaries`

| Addition | Purpose |
|----------|---------|
| `user_id uuid` | Owner for unlinked summary rows; avoids global collision on handle. |
| `scope = 'unlinked_timeline'` | Third variant in CHECK constraint. |
| `unlinked_channel text` | `email` \| `sms` \| `whatsapp` |
| `unlinked_handle text` | Exact match to `inbox_conversations.primary_handle` |

**Constraints:**

- For `unlinked_timeline`: `conversation_id` NULL, `person_id` NULL, `unlinked_channel` NOT NULL, `unlinked_handle` NOT NULL, `user_id` NOT NULL.
- Unique partial index: `(user_id, unlinked_channel, unlinked_handle)` WHERE `scope = 'unlinked_timeline'`.

**Legacy rows:** `user_id` nullable for existing `conversation` / `customer_timeline` rows until optional backfill (not required for MVP if RLS uses joins only).

## API filters (optional columns)

**`ConversationFilters`** (client type) extensions used only for narrow fetches:

- `person_id_is_null: true`
- `channel: InboxChannel`
- `primary_handle_exact: string` — maps to `.eq('primary_handle', value)`

No DB migration required for filters beyond summaries.
