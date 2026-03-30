# API Contracts: People ↔ Inbox Linking

## Conversation Filters

### ConversationFilters (extended)

```typescript
interface ConversationFilters {
  status?: 'open' | 'archived' | 'closed';
  channel?: 'email' | 'sms' | 'whatsapp' | 'phone';
  unread_only?: boolean;
  search?: string;
  person_id?: string | null;   // filter by linked person
  unlinked_only?: boolean;     // person_id is null (default when no person selected)
}
```

### Behavior

| person_id | unlinked_only | Result |
|-----------|---------------|--------|
| null/undefined | true | Conversations where `person_id IS NULL` |
| null/undefined | false/undefined | No person filter (all open) |
| string (uuid) | * | Conversations where `person_id = uuid` |

**Note:** `unlinked_only` and `person_id` are mutually exclusive in practice. When `person_id` is set, ignore `unlinked_only`.

---

## Link / Unlink API

### linkConversation

**Signature:**
```typescript
function linkConversation(conversationId: string, personId: string): Promise<InboxConversation>
```

**Effect:** Updates `inbox_conversations` set `person_id=personId`, `link_state='linked'`, `link_meta='{}'` where id = conversationId.

**Returns:** Updated conversation row.

**Errors:** Throws on DB error or not found.

---

### unlinkConversation

**Signature:**
```typescript
function unlinkConversation(conversationId: string): Promise<InboxConversation>
```

**Effect:** Updates `inbox_conversations` set `person_id=null`, `link_state='unlinked'`, `link_meta='{}'` where id = conversationId.

**Returns:** Updated conversation row.

**Errors:** Throws on DB error or not found.

---

## Edge Function: Auto-link Helper

### attemptAutoLink (internal, _shared)

**Signature:**
```typescript
export async function attemptAutoLink(
  supabase: SupabaseClient,
  conversationId: string,
  channel: 'email' | 'sms' | 'whatsapp',
  primaryHandle: string
): Promise<void>
```

**Preconditions:**
- Conversation exists
- primaryHandle is trimmed, non-empty for matching

**Postconditions:**
- 0 matches: `person_id=null`, `link_state='unlinked'`, `link_meta='{}'`
- 1 match: `person_id=<id>`, `link_state='linked'`, `link_meta='{}'`
- >1 matches: `person_id=null`, `link_state='ambiguous'`, `link_meta={ candidates: [ids], matched_on }`

**Idempotent:** If `person_id` already set, no-op.

---

## React Query Hooks

### useLinkConversation

```typescript
const { mutate, mutateAsync, isPending } = useLinkConversation();
// mutate({ conversationId, personId })
```

**Invalidates:** `inboxKeys.all`, `inboxKeys.detail(conversationId)` on success.

---

### useUnlinkConversation

```typescript
const { mutate, mutateAsync, isPending } = useUnlinkConversation();
// mutate(conversationId)
```

**Invalidates:** Same as useLinkConversation.

---

## Person Display

**Display name:** `first_name + last_name` (trimmed). If both empty: fallback to `email` or `phone`.

```typescript
function getPersonDisplayName(customer: Customer): string {
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return name || customer.email || customer.phone || '—';
}
```
