# Tasks: Orders Multiple People with Primary

## Task Summary

| # | Task | Type | File | Phase |
|---|------|------|------|-------|
| 1.1 | Create order_people migration | Create | supabase/migrations/... | 1 |
| 2.1 | Add fetchOrderPeople API | Update | orders.api.ts | 2 |
| 2.2 | Add upsertOrderPeople API | Update | orders.api.ts | 2 |
| 3.1 | Add OrderPerson type, extend Order | Update | orders.types.ts | 3 |
| 3.2 | Add useOrderPeople hook | Update | useOrders.ts | 3 |
| 3.3 | Add useSaveOrderPeople mutation | Update | useOrders.ts | 3 |
| 4.1 | CreateOrderDrawer: multi-select + primary | Update | CreateOrderDrawer.tsx | 4 |
| 4.2 | EditOrderDrawer: multi-select + primary | Update | EditOrderDrawer.tsx | 4 |
| 5.1 | QA checklist | Verify | - | 5 |

---

## Phase 1: DB Migration

### Task 1.1: Create order_people Table

**File:** `supabase/migrations/20260125120000_create_order_people_table.sql`

- Create table with id, order_id, person_id, is_primary, created_at
- unique(order_id, person_id)
- partial unique index: one primary per order
- indexes on order_id, person_id
- RLS policies (select, insert, update, delete for anon/authenticated if required)

---

## Phase 2: API Layer

### Task 2.1: fetchOrderPeople

**File:** `src/modules/orders/api/orders.api.ts`

- Query order_people with join to customers
- Return `{ id, order_id, person_id, is_primary, created_at, customers }`

### Task 2.2: upsertOrderPeople

**File:** `src/modules/orders/api/orders.api.ts`

- Fetch existing rows for order
- Delete rows for persons not in new list
- Upsert remaining (insert or update is_primary)
- Ensure exactly one primary; if none, set first
- Update orders.person_id and orders.person_name from primary

---

## Phase 3: Hooks + Types

### Task 3.1: Types

**File:** `src/modules/orders/types/orders.types.ts`

- Add OrderPerson interface
- Extend Order with people?: OrderPerson[], primary_person_id?: string | null

### Task 3.2: useOrderPeople

**File:** `src/modules/orders/hooks/useOrders.ts`

- Query key: ordersKeys.orderPeople(orderId)
- Enabled when orderId truthy

### Task 3.3: useSaveOrderPeople

**File:** `src/modules/orders/hooks/useOrders.ts`

- Mutation calling upsertOrderPeople
- Invalidate ordersKeys.all, ordersKeys.detail(orderId), ordersKeys.orderPeople(orderId)

---

## Phase 4: UI

### Task 4.1: CreateOrderDrawer

- Replace single Person Select with multi-select (chips) + search
- Primary selector when >1 selected
- Validation: ≥1 person required; exactly one primary
- On save: create order → upsertOrderPeople(order.id, people) → mirror primary to orders

### Task 4.2: EditOrderDrawer

- Load people from order_people (fallback to orders.person_id if none)
- Multi-select + primary selector
- On save: upsertOrderPeople + mirror primary

---

## Phase 5: QA

- Create order with 1 person → order_people 1 row primary=true; orders.person_id set
- Create with 2+ people → correct rows; one primary; orders.person_id mirrors
- Edit: add/remove people; change primary; persists
- Legacy orders (no order_people): edit loads from orders.person_id; save creates order_people
- Orders list + other screens still work

---

## Commit Plan

1. "Create order_people join table"
2. "Add Orders API + hooks for order_people"
3. "Multi-select People with primary in order drawers"
