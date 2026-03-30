# Research: Invoicing Derive Person via Orders.invoice_id

## Problem Statement

The Invoicing CustomerDetailsPopover currently uses `invoice.order_id` to derive person_id, but this field is always NULL (confirmed by SQL). The correct relationship is Invoice → Orders via `orders.invoice_id = invoice.id`, where Orders contain `person_id`.

## Current State Analysis

### Database Schema

**Invoices Table (`public.invoices`):**
- `id uuid pk` - Primary key
- `order_id uuid null` - FK to orders (always NULL, unused)
- `customer_name text not null` - Customer name snapshot
- Other invoice fields...

**Orders Table (`public.orders`):**
- `id uuid pk` - Primary key
- `invoice_id uuid null` - FK to invoices (added in migration `20251222003231_add_invoice_id_to_orders.sql`)
- `person_id uuid null` - FK to customers/people (added in migration `20260106003849_add_person_fields_to_orders.sql`)
- `person_name text null` - Snapshot of person name
- Other order fields...

### Relationship Analysis

**Incorrect Relationship (Current):**
- Invoice → Order: `invoices.order_id` → `orders.id` (always NULL, unused)

**Correct Relationship:**
- Invoice → Orders: `invoices.id` ← `orders.invoice_id` (one-to-many)
- Order → Person: `orders.person_id` → `customers.id` (optional FK)

### Data Access Patterns

**Current Implementation:**
- `CustomerDetailsPopover` uses `orderId` prop
- `orderId` derived from `invoice.order_id` (always NULL)
- Result: Popover always shows "Unlinked"

**Existing Functions:**
- `fetchOrdersByInvoice(invoiceId)` - Fetches full Order objects by invoice_id
- `useOrdersByInvoice(invoiceId)` - React Query hook for orders by invoice
- `fetchOrderPersonId(orderId)` - Fetches person_id from single order
- `useOrderPersonId(orderId)` - React Query hook for order person_id

**Gap:**
- No lightweight function to fetch only person_ids from orders linked to invoice
- Need to handle multiple person_ids per invoice

## Solution Approach

### Key Requirements

1. **Lightweight Query:** Fetch only `person_id` values (not full Order objects)
2. **Multiple People Handling:** Detect when invoice has orders with different person_ids
3. **Lazy Loading:** Queries only when popover opens
4. **Backward Compatibility:** Support existing `personId` and `orderId` props

### Implementation Strategy

1. **Add `fetchInvoicePersonIds(invoiceId)`:**
   - Query orders table filtered by `invoice_id`
   - Select only `person_id` column
   - Return array of unique non-null person_ids

2. **Add `useInvoicePersonIds(invoiceId, { enabled })`:**
   - React Query hook with conditional enabling
   - Cache by invoiceId

3. **Enhance `CustomerDetailsPopover`:**
   - Add `invoiceId` prop
   - Resolution priority: personId > invoiceId > orderId > null
   - Link state: 'linked' | 'unlinked' | 'multiple'
   - Handle multiple people case (show badge + message, no People fetch)

4. **Update Invoicing Integration:**
   - Pass `invoiceId={invoice.id}` instead of `orderId={invoice.order_id}`
   - Remove `orderId` prop usage

## Technical Considerations

### Query Performance
- Minimal query: select only `person_id` (not full Order objects)
- Index exists on `orders.invoice_id` (created in migration)
- Client-side deduplication using Set

### Edge Cases
- Invoice with 0 orders → 'unlinked'
- Invoice with orders but all have null person_id → 'unlinked'
- Invoice with orders with single person_id → 'linked'
- Invoice with orders with multiple person_ids → 'multiple'

### UX Decisions
- **Multiple people:** Show "Multiple people" badge and message, do NOT fetch People data
- **Rationale:** Avoids confusion about which person to show, safest UX

## Files to Modify

1. `src/modules/orders/api/orders.api.ts` - Add `fetchInvoicePersonIds`
2. `src/modules/orders/hooks/useOrders.ts` - Add `useInvoicePersonIds`
3. `src/shared/components/customer/CustomerDetailsPopover.tsx` - Add `invoiceId` prop and resolution logic
4. `src/modules/invoicing/pages/InvoicingPage.tsx` - Update to pass `invoiceId`
5. `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` - Update to pass `invoiceId`

## Dependencies

- No database migrations required
- Uses existing schema relationships
- No breaking changes to existing APIs
- Backward compatible with existing props

## Success Criteria

- Invoicing popover shows "Linked" when invoice has orders with single person_id
- Invoicing popover shows "Multiple people" when invoice has orders with multiple person_ids
- Invoicing popover shows "Unlinked" when invoice has no orders
- No reliance on `invoices.order_id` (always NULL)
- Lazy loading maintained (queries only when popover opens)
- No regressions in Orders module

