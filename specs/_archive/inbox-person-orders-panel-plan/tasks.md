# Tasks: Inbox Person Orders Panel + Embedded Order Details

## Task Summary

| # | Task | Type | File | Phase |
|---|------|------|------|-------|
| 1.1 | Add fetchOrdersByPersonId API | Update | `orders.api.ts` | 1 |
| 1.2 | Add useOrdersByPersonId hook | Update | `useOrders.ts` | 1 |
| 2.1 | Create PersonOrdersPanel component | Create | `PersonOrdersPanel.tsx` | 2 |
| 3.1 | Compute activePersonId, add selectedOrderId state | Update | `UnifiedInboxPage.tsx` | 3 |
| 3.2 | Split right panel: ConversationView + PersonOrdersPanel | Update | `UnifiedInboxPage.tsx` | 3 |
| 4.1 | QA: manual verification | Verify | - | 4 |

---

## Phase 1: Data Layer (Orders)

### Task 1.1: Add fetchOrdersByPersonId

**Type:** UPDATE  
**File:** `src/modules/orders/api/orders.api.ts`

**Description:** Add function to fetch orders by person_id.

**Implementation:**
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

**Acceptance Criteria:** Returns Order[] ordered newest first.

---

### Task 1.2: Add useOrdersByPersonId Hook

**Type:** UPDATE  
**File:** `src/modules/orders/hooks/useOrders.ts`

**Changes:**
- Add `ordersKeys.byPerson(personId)`
- Add `useOrdersByPersonId(personId)` — enabled when `!!personId`
- Import and call `fetchOrdersByPersonId`

**Acceptance Criteria:** Hook fetches when personId truthy; returns Order[].

---

## Phase 2: PersonOrdersPanel Component

### Task 2.1: Create PersonOrdersPanel

**Type:** CREATE  
**File:** `src/modules/inbox/components/PersonOrdersPanel.tsx`

**Props:**
- `personId: string | null`
- `selectedOrderId: string | null`
- `onSelectOrder: (id: string) => void`
- `onCloseOrder: () => void`

**Responsibilities:**
- Header: "Orders"
- When `!personId`: show "Select a person to view orders" placeholder
- When `personId`: use `useOrdersByPersonId(personId)`
  - Loading: skeleton or "Loading..."
  - Empty: "No orders for this person yet"
  - Error: error message
  - List: order items (order_number, status/progress, created_at, total)
  - Click item → `onSelectOrder(order.id)`
- When `selectedOrderId`: use `useOrder(selectedOrderId)`, render `OrderDetailsSidebar` embedded
  - Pass `order`, `onClose` (calls `onCloseOrder`), `onOrderUpdate` (optional)

**Order list item fields:** `getOrderDisplayId`, `getOrderTotalFormatted` (or value), `created_at`, progress/status if available.

**Acceptance Criteria:**
- Placeholder when no person
- List loads and displays; click selects order
- OrderDetailsSidebar renders inline when order selected
- Close clears selection

---

## Phase 3: Wire into UnifiedInboxPage

### Task 3.1: State and activePersonId

**Type:** UPDATE  
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Changes:**
- Fetch `selectedConversation` (or get `person_id` from conversation) — need `useConversation(selectedConversationId)` to get conversation data
- Compute `activePersonId = selectedConversation?.person_id ?? selectedPersonId`
- Add state: `selectedOrderId: string | null`
- Effect: when `activePersonId` changes, if `selectedOrderId` is set and the order's person_id ≠ activePersonId, clear `selectedOrderId` (or keep if order belongs to new person — spec says reset when person changes)

**Acceptance Criteria:** activePersonId correct; selectedOrderId resets on person switch.

---

### Task 3.2: Layout Split

**Type:** UPDATE  
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Changes:**
- Right column (currently `<div><ConversationView /></div>`) becomes:
  ```jsx
  <div className="flex flex-col gap-4">
    <div className="min-h-[200px]"><ConversationView /></div>
    <PersonOrdersPanel
      personId={activePersonId}
      selectedOrderId={selectedOrderId}
      onSelectOrder={setSelectedOrderId}
      onCloseOrder={() => setSelectedOrderId(null)}
    />
  </div>
  ```
- PersonOrdersPanel shows placeholder when `!activePersonId`

**Acceptance Criteria:** Right side has ConversationView top, PersonOrdersPanel bottom; panel shows only when person context exists.

---

## Phase 4: QA

### Task 4.1: Manual QA

- [ ] Select linked conversation → orders list for that person; click order → details
- [ ] Select person in sidebar → orders list; click order → details
- [ ] Person with no orders → empty state
- [ ] Switch person → list refreshes, selected order resets
- [ ] No regressions: tabs, search, archive, send

---

## Commit Plan

**Commit 1:** "Add orders fetch by person id"  
- orders.api.ts, useOrders.ts

**Commit 2:** "Show person orders panel in Inbox with embedded order details"  
- PersonOrdersPanel.tsx, UnifiedInboxPage.tsx

---

## Progress Tracking

**Phase 1**
- [X] Task 1.1: fetchOrdersByPersonId
- [X] Task 1.2: useOrdersByPersonId

**Phase 2**
- [X] Task 2.1: PersonOrdersPanel

**Phase 3**
- [X] Task 3.1: activePersonId + selectedOrderId
- [X] Task 3.2: Layout split

**Phase 4**
- [ ] Task 4.1: QA
