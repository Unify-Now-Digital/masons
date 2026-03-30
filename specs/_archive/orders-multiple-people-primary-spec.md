# Orders Support Multiple People (Co-customers) with One Primary Person

## Overview

**Goal:** In the Order creation/edit drawer, the "Person" field must support selecting multiple People (customers). Users select multiple People via a multi-select UI (chips/tags). Exactly one selected Person is the **Primary Person**, who drives denormalized customer fields and display logic. Other selected People are linked as co-customers.

---

## Discovery Summary

### DB: Orders ↔ People
- **orders.person_id** (uuid, FK → customers.id) — single primary person ✓
- **orders.person_name** (text) — snapshot of person name
- **Migration:** `20260106003849_add_person_fields_to_orders.sql`
- **Index:** `idx_orders_person_id`
- **No join table** exists (no order_people, orders_people, order_customers, order_contacts)

### Frontend: Order Drawers
- **CreateOrderDrawer:** Single `Select` for `person_id`; `useCustomersList()` for options; optional; person_name set from selected customer
- **EditOrderDrawer:** Similar pattern with customers
- **Form field:** `person_id` with `NO_PERSON_SENTINEL` for "None"

### People selector elsewhere
- **LinkConversationModal:** `useCustomersList()` + search filter; single select (link to one person)
- **PeopleSidebar:** `useCustomersList()` + client-side search; single select
- **CustomersPage:** Table with search; no reusable multi-select component yet

---

## Target Data Model

### New join table: order_people

```sql
create table public.order_people (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  person_id uuid not null references public.customers(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(order_id, person_id)
);

-- At most one primary per order
create unique index idx_order_people_one_primary_per_order
  on public.order_people (order_id) where is_primary = true;
```

### Backward compatibility
- Keep `orders.person_id` (do not drop)
- On save: `order_people` is source of truth; optionally mirror primary into `orders.person_id` for legacy reads
- Existing orders with only `person_id` set: migration or backfill to populate `order_people` (or handle in read path)

---

## Write Rules

1. Order must have ≥ 1 person selected.
2. Exactly 1 selected person must be primary.
3. On save:
   - Upsert `order_people` rows for all selected persons
   - Set `is_primary = true` for chosen primary, `false` for others
   - Remove rows for persons that were unselected
4. Denormalized fields on orders: name/email/phone (if present) populated from Primary Person only.

---

## UI/UX Requirements (Order Drawer)

### Replace single Person selector with

1. **Multi-select People dropdown (chips/tags)**
   - Search by name, email, phone
   - Selecting adds a chip; chips removable
   - Reuse or extend patterns from `useCustomersList` + search

2. **Primary selector**
   - When multiple people selected: show "Primary" control (radio or dropdown)
   - Default primary = first selected
   - User can change primary among selected people
   - When only one person: primary implicit

### Validation
- Disable Save if no people selected
- If selected but none marked primary: auto-select first (preferred) OR validation error

---

## Read Behavior

When editing an existing order:
- Load selected people from `order_people`
- Determine primary from `is_primary` (fallback to `orders.person_id` for legacy)
- Populate UI accordingly

---

## Non-Goals
- No roles beyond primary/non-primary (no billing/next_of_kin)
- No changes to invoice architecture
- No changes to People module UI

---

## Acceptance Criteria
- [ ] Order drawer allows selecting multiple People with chips
- [ ] Exactly one primary person is always set
- [ ] Saving persists into `order_people`; re-opening shows same selections
- [ ] Primary person drives displayed customer fields and denormalized order values
- [ ] Existing orders with single person still work (backward compatible)

---

## Files Likely to Change

| Area | Files |
|------|-------|
| DB | Migration: create `order_people` table, constraints, indexes |
| API | Orders API: fetch/save order_people; add `fetchOrderPeople(orderId)`, `upsertOrderPeople(orderId, people)` |
| Hooks | useOrderPeople, useUpsertOrderPeople; extend order types |
| Types | Order includes `persons[]`, `primary_person_id` (derived) |
| CreateOrderDrawer | Replace Person Select with multi-select + primary selector |
| EditOrderDrawer | Same replacement |
| Views | Optional: `orders_with_options_total` may need join to primary person for display |

---

**Branch:** `feature/orders-multiple-people-primary`  
**Spec version:** 1.0
