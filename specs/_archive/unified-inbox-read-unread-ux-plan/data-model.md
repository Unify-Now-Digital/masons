## Data Model – Unified Inbox Read/Unread UX

### Conversations

- **Entity**: Inbox conversation (existing)
- **Key fields (assumed)**
  - `id` (primary identifier)
  - `company_id`
  - `channel` (e.g. `email`, `sms`, `whatsapp`)
  - `unread_count` (integer) – primary signal used by the UI:
    - `unread_count > 0` → conversation is considered **unread**
    - `unread_count === 0` → conversation is considered **read**
  - Optional read-tracking fields (e.g. `last_read_at`, `is_read`) may exist but are not required to change for this feature.
- **Constraints for this feature**
  - No new columns or tables.
  - No migration changes to inbox conversations or messages.
  - All changes are at the API and React layer, using `unread_count` (and any existing read metadata) as-is.

### Messages

- **Entity**: Inbox message (existing)
- **Key fields (assumed)**
  - `id`, `conversation_id`, `direction` (inbound/outbound), `channel`, timestamps, external ids.
- **For this feature**
  - Messages remain unchanged; we do not touch message-level read flags.
  - All UX logic derives from conversation-level unread state.

