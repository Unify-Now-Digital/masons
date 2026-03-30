# Research: Fix Orders Customer/Person Assignment

## Problem Analysis

### Current State
- Orders table has `customer_name` field (text, not null)
- `customer_name` is used in UI to display "Deceased Name"
- Orders list "Customer" column shows Deceased name (confusing)
- No way to assign a Person/Customer when creating/editing Orders
- No relationship between Orders and Customers/People tables

### Root Cause
- Historical design: `customer_name` was repurposed for Deceased Name
- Missing FK relationship to customers table
- UI mapping doesn't match database semantics

### Impact
- User confusion: "Customer" column shows deceased person, not actual customer
- No way to link orders to people who placed them
- Invoicing module can't properly inherit person assignment

---

## Technical Research

### Database Schema

**Orders Table:**
- `id uuid pk`
- `customer_name text not null` - Currently used for Deceased Name
- No `person_id` or `customer_id` field

**Customers Table:**
- `id uuid pk`
- `first_name text`
- `last_name text`
- No relationship to Orders

### Data Access Patterns

**Current:**
- `useOrdersList()` fetches all orders
- `transformOrdersForUI()` maps `customer_name` to `customer` field
- No join with customers table

**Needed:**
- Join with customers table for person name
- Store person_id and person_name snapshot
- Transform to show Person name in Customer column

---

## Solution Approach

### Database Changes
- Add `person_id uuid null` (FK to customers)
- Add `person_name text null` (snapshot)
- Add index on `person_id`
- All fields nullable for backward compatibility

### UI Changes
- Add Person selector to CreateOrderDrawer
- Add Person selector to EditOrderDrawer
- Update Orders list to show Person name in Customer column
- Keep Deceased Name field/column separate

### Integration
- Invoicing module: inherit Person from invoice when creating inline orders
- Match invoice `customer_name` to customer to find `person_id`

---

## Constraints & Considerations

### Backward Compatibility
- All new fields must be nullable
- Existing orders continue to work (person_id = null)
- No changes to existing `customer_name` column

### Performance
- Index on `person_id` for efficient joins
- Snapshot `person_name` avoids join when displaying

### Data Integrity
- FK constraint with `on delete set null` (preserves orders if customer deleted)
- Snapshot ensures name available even if customer deleted

---

## Open Questions Resolved

1. **Customers table name:** Confirmed as `customers` (not `people`)
2. **Person name format:** `first_name + ' ' + last_name`
3. **Deceased column:** Add separate column or keep existing location
4. **Snapshot strategy:** Store snapshot for resilience
5. **Invoice integration:** Match by name to find person_id

---

## References

- Specification: `specs/fix-orders-customer-person-assignment.md`
- Existing patterns: Workers module, Invoicing module
- Database conventions: `.cursor/rules/postgres-sql-style-guide.mdc`

