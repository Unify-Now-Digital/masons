# Research: Split Phone Tab into SMS + WhatsApp

## Phase 0 — Channel Values Sanity Check

### SQL to Run (Pre-implementation)

```sql
select channel, count(*) from inbox_conversations group by channel;
```

**Expected:** Channels are lowercase: `email`, `sms`, `whatsapp`. No `wa`, `WA`, or other variants.

**Deliverable:** Confirms filters should use `'sms'` and `'whatsapp'` directly (not `'phone'` alias).

---

## Current Implementation

### UnifiedInboxPage.tsx
- **Tabs (4):** All, Unread, Email, Phone
- **TabsList:** `grid-cols-4`
- **Filters mapping:** `activeTab === 'phone'` → `base.channel = 'phone'`

### inboxConversations.api.ts
- `filters.channel === 'phone'` → `query.in('channel', ['sms', 'whatsapp'])`
- Otherwise → `query.eq('channel', filters.channel)`

### inbox.types.ts
- `ConversationFilters.channel`: `'email' | 'sms' | 'whatsapp' | 'phone'`

---

## Files to Modify (Authoritative)

1. `src/modules/inbox/pages/UnifiedInboxPage.tsx`
2. `src/modules/inbox/api/inboxConversations.api.ts`
3. `src/modules/inbox/types/inbox.types.ts`
