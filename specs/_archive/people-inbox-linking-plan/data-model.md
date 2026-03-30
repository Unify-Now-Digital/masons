# Data Model: People ↔ Inbox Linking

## Current Schema

### inbox_conversations (existing)

- `id` (uuid, PK)
- `channel` ('email' | 'sms' | 'whatsapp')
- `primary_handle` (text) — email or phone (E.164)
- `subject` (text, nullable)
- `status` ('open' | 'archived' | 'closed')
- `unread_count` (int)
- `last_message_at` (timestamptz, nullable)
- `last_message_preview` (text, nullable)
- `created_at`, `updated_at` (timestamptz)
- `external_thread_id` (text, nullable) — for SMS find-or-create

### customers (existing)

- `id` (uuid, PK)
- `first_name`, `last_name` (text)
- `email` (text, nullable)
- `phone` (text, nullable) — E.164
- `address`, `city`, `country` (text, nullable)
- `created_at`, `updated_at` (timestamptz)

---

## New Columns: inbox_conversations

| Column       | Type   | Nullable | Default    | Constraint |
|-------------|--------|----------|------------|------------|
| `person_id` | uuid   | yes      | null       | FK → `public.customers(id)` ON DELETE SET NULL |
| `link_state`| text   | no       | 'unlinked' | CHECK (link_state IN ('linked','unlinked','ambiguous')) |
| `link_meta` | jsonb  | no       | '{}'       | - |

**link_meta structure (ambiguous only):**
```json
{
  "candidates": ["uuid1", "uuid2"],
  "matched_on": "email" | "phone"
}
```

---

## Indexes

1. **Per-person conversation list:**
   ```sql
   create index idx_inbox_conversations_person_id_last_message_at
     on public.inbox_conversations (person_id, last_message_at desc nulls last)
     where person_id is not null;
   ```

2. **Unlinked / ambiguous filters:**
   ```sql
   create index idx_inbox_conversations_link_state_last_message_at
     on public.inbox_conversations (link_state, last_message_at desc nulls last);
   ```

---

## Migration SQL

**File:** `supabase/migrations/20260124130000_add_person_link_to_inbox_conversations.sql`

```sql
-- People ↔ Inbox linking: person_id, link_state, link_meta
-- Affected: public.inbox_conversations
-- Adds FK to customers, indexes for filtering.

-- person_id: FK to customers (People)
alter table public.inbox_conversations
  add column if not exists person_id uuid
  references public.customers(id) on delete set null;

comment on column public.inbox_conversations.person_id is 'Linked person (customer) when link_state=linked.';

-- link_state: linked | unlinked | ambiguous
alter table public.inbox_conversations
  add column if not exists link_state text not null default 'unlinked'
  check (link_state in ('linked','unlinked','ambiguous'));

comment on column public.inbox_conversations.link_state is 'Auto-link state: linked, unlinked, or ambiguous (multiple matches).';

-- link_meta: candidates for ambiguous, matched_on field
alter table public.inbox_conversations
  add column if not exists link_meta jsonb not null default '{}'::jsonb;

comment on column public.inbox_conversations.link_meta is 'Ambiguous: { candidates: [uuid], matched_on: "email"|"phone" }.';

-- Index: per-person conversation list
create index if not exists idx_inbox_conversations_person_id_last_message_at
  on public.inbox_conversations (person_id, last_message_at desc nulls last)
  where person_id is not null;

-- Index: unlinked / ambiguous filters
create index if not exists idx_inbox_conversations_link_state_last_message_at
  on public.inbox_conversations (link_state, last_message_at desc nulls last);
```

---

## Compatibility

- All new columns have defaults or are nullable.
- Existing rows get `person_id=null`, `link_state='unlinked'`, `link_meta='{}'`.
- No breaking changes to existing queries.
- Existing Inbox flows continue to work when `person_id` is null.

---

## Type Definitions (Frontend)

### InboxConversation (extended)

```typescript
export interface InboxConversation {
  // ... existing fields ...
  person_id: string | null;
  link_state: 'linked' | 'unlinked' | 'ambiguous';
  link_meta: {
    candidates?: string[];
    matched_on?: 'email' | 'phone';
  };
}
```

### ConversationFilters (extended)

```typescript
export interface ConversationFilters {
  status?: 'open' | 'archived' | 'closed';
  channel?: 'email' | 'sms' | 'whatsapp' | 'phone';
  unread_only?: boolean;
  search?: string;
  person_id?: string | null;   // filter by person
  unlinked_only?: boolean;     // person_id is null (default when no person selected)
}
```

---

## Data Access Patterns

### Unlinked conversations (default view)

```sql
SELECT * FROM inbox_conversations
WHERE status = 'open' AND person_id IS NULL
ORDER BY last_message_at DESC NULLS LAST, created_at DESC;
```

### Conversations for a person

```sql
SELECT * FROM inbox_conversations
WHERE status = 'open' AND person_id = $1
ORDER BY last_message_at DESC NULLS LAST, created_at DESC;
```

### Ambiguous conversations

```sql
SELECT * FROM inbox_conversations
WHERE status = 'open' AND link_state = 'ambiguous';
```
