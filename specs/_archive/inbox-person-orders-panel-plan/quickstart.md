# Quickstart: Inbox Person Orders Panel

## Branch & Spec

- **Branch:** `feature/inbox-person-orders-panel`
- **Spec:** `specs/inbox-person-orders-panel-embedded-order-details.md`

---

## Implementation Order

1. **API + Hook:** `fetchOrdersByPersonId` in orders.api.ts; `useOrdersByPersonId` in useOrders.ts
2. **PersonOrdersPanel:** New component — orders list + embedded OrderDetailsSidebar
3. **UnifiedInboxPage:** Compute `activePersonId`, add `selectedOrderId`, split right column (ConversationView + PersonOrdersPanel)

---

## Key Files

| File | Action |
|------|--------|
| orders.api.ts | Add fetchOrdersByPersonId |
| useOrders.ts | Add useOrdersByPersonId, ordersKeys.byPerson |
| PersonOrdersPanel.tsx | Create |
| UnifiedInboxPage.tsx | Layout + state |

---

## activePersonId Logic

```typescript
const { data: selectedConversation } = useConversation(selectedConversationId);
const activePersonId = selectedConversation?.person_id ?? selectedPersonId ?? null;
```
