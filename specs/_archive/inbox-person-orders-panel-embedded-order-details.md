# Show Person's Orders inside Unified Inbox (Embedded Order Details)

## Overview

**Goal:** When a Person is selected or a conversation is linked to a person in Unified Inbox, show that person's orders in an embedded panel inside Inbox—with the same Order Details UI used in the Orders module. People-centric within Inbox only.

**Scope:** Inbox layout + new PersonOrdersPanel component. Reuse existing orders API, hooks, and OrderDetailsSidebar. No changes to People module or order CRUD.

---

## Context

### Current Inbox Layout
- **File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **Layout:** 3 columns — People sidebar | Conversations list | Conversation thread
- **State:** `selectedPersonId`, `selectedConversationId`, etc.
- **Person context:** From People sidebar selection OR from selected conversation's `person_id`

### Orders ↔ Customers Link (Discovery)
- **DB:** `orders.person_id` (uuid, FK → `customers.id`) ✓
- **Migration:** `20260106003849_add_person_fields_to_orders.sql`
- **Index:** `idx_orders_person_id`
- **Strict FK:** Use `orders.person_id` for queries; no fuzzy matching

### Existing Orders Module
- **Order list:** `SortableOrdersTable` (complex table with columns)
- **Order details:** `OrderDetailsSidebar` — takes `order`, `onClose`, `onOrderUpdate`
- **API:** `fetchOrder(id)`, `fetchOrdersByInvoice(invoiceId)` — no `fetchOrdersByPersonId` yet
- **View:** `orders_with_options_total` — includes `person_id`, `order_number`, totals, etc.
- **Display ID:** `getOrderDisplayId(order)` → `ORD-000123` format

---

## UI Layout (Option A — Preferred)

Right side becomes vertical split:
- **Top:** ConversationView (thread)
- **Bottom:** PersonOrdersPanel (orders list + embedded OrderDetailsSidebar)

PersonOrdersPanel visibility:
- **Shown** when active person exists (from conversation or sidebar)
- **Hidden / placeholder** when no person context ("Select a person to view orders")

---

## Person Context Rules

Active person is determined by (priority order):
1. **Selected conversation has `person_id`** → use that person
2. **Else:** Person selected in PeopleSidebar → use that person
3. **Else:** No active person → hide or show placeholder

Implementation: Compute `activePersonId` from `selectedConversation?.person_id ?? selectedPersonId`.

---

## Data Requirements

### New API: fetchOrdersByPersonId

**File:** `src/modules/orders/api/orders.api.ts`

```typescript
export async function fetchOrdersByPersonId(personId: string) {
  const { data, error } = await supabase
    .from('orders_with_options_total')
    .select('*, customers(id, first_name, last_name)')
    .eq('person_id', personId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeOrder);
}
```

### New Hook: useOrdersByPerson

**File:** `src/modules/orders/hooks/useOrders.ts`

- Query key: `['orders', 'byPerson', personId]`
- Enabled when `personId` is truthy
- Invalidate on order create/update if order has same person_id (optional for MVP)

---

## Functional Requirements

### 1. Orders List (PersonOrdersPanel)
- Fetch orders via `useOrdersByPerson(activePersonId)`
- List items show: order_number (ORD-000123), status-like field if available, created_at/updated_at, total (from view)
- Loading state: skeleton or "Loading..."
- Empty state: "No orders for this person yet"
- Click order → set `selectedOrderId`, show embedded OrderDetailsSidebar

### 2. Embedded Order Details
- Reuse `OrderDetailsSidebar` from Orders module
- Props: `order` (from `useOrder(selectedOrderId)`), `onClose`, `onOrderUpdate`
- Render inside Inbox panel (not as global sheet) — may require variant or embedding in a scrollable container
- No route change; stays in Inbox

### 3. State Behavior
- `activePersonId` = `selectedConversation?.person_id ?? selectedPersonId`
- `selectedOrderId` — when switching person, clear if the selected order doesn't belong to new person; keep if it does
- Switching conversations updates `activePersonId` → order list refetches
- Search/tab filters unchanged

---

## Non-Goals
- No changes to People module pages
- No new order CRUD
- No fuzzy linking (FK only)
- No invoice/payment logic changes

---

## Acceptance Criteria
- [ ] Selecting a linked conversation shows that person's orders list
- [ ] Clicking an order shows embedded order details (same UI as Orders module)
- [ ] No person selected/linked → panel hidden or shows "Select a person to view orders"
- [ ] No regressions to Inbox (tabs, unread, archive, sending)

---

## QA Checklist
- [ ] Person with multiple orders: list loads, order click opens details
- [ ] Select conversation linked to person: orders panel shows correct person's orders
- [ ] Switch person: list updates, selected order resets if order doesn't belong to new person
- [ ] Person with zero orders: empty state
- [ ] Orders displayed belong to person (FK-based)

---

## Files to Change

| File | Action |
|------|--------|
| `src/modules/orders/api/orders.api.ts` | Add `fetchOrdersByPersonId` |
| `src/modules/orders/hooks/useOrders.ts` | Add `useOrdersByPerson`, `ordersKeys.byPerson` |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` | Create — orders list + embedded OrderDetailsSidebar |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Layout: right split (ConversationView + PersonOrdersPanel), wire `activePersonId` |

---

**Branch:** `feature/inbox-person-orders-panel`  
**Spec version:** 1.0
