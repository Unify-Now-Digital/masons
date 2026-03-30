# Quickstart: Split Phone Tab into SMS + WhatsApp

## Branch & Spec

- **Branch:** `feature/split-phone-tab-sms-whatsapp`
- **Spec:** `specs/split-phone-tab-sms-whatsapp-unified-inbox.md`

---

## Implementation Order

1. **Types** (`inbox.types.ts`): Remove `'phone'` from `ConversationFilters.channel`
2. **API** (`inboxConversations.api.ts`): Remove `phone` → `IN ('sms','whatsapp')` branch
3. **UI** (`UnifiedInboxPage.tsx`): Replace Phone with SMS + WhatsApp tabs, update filter mapping

---

## Key Changes

| File | Change |
|------|--------|
| inbox.types.ts | `channel?: 'email' \| 'sms' \| 'whatsapp'` |
| inboxConversations.api.ts | Remove `channel === 'phone'` branch |
| UnifiedInboxPage.tsx | 5 tabs; `activeTab === 'sms'` / `'whatsapp'` → `base.channel` |

---

## Single Commit

```
Split Phone tab into SMS and WhatsApp
```
