# Invoice-Centric Order Creation

## Overview

Enable invoice-centric order creation by adding UI components that allow orders to be created in the context of an Invoice. Orders created from an Invoice will automatically have their `invoice_id` field set, establishing the invoice-centric workflow.

**Context:**
- Invoices are the architectural spine (established in previous feature: `orders.invoice_id` column added)
- The `orders.invoice_id` foreign key relationship already exists in the database
- Orders can currently be created independently via the Orders module
- Invoices are displayed in a table view in `InvoicingPage.tsx`
- There is no dedicated Invoice detail page yet (Eye button is placeholder)

**Goal:**
- Add Orders section to Invoice detail/view page
- Add "Add Order" action from Invoice context
- Display Orders scoped to the current Invoice
- Automatically set `orders.invoice_id` when creating orders from Invoice context
- Maintain backward compatibility: Orders can still be created without `invoice_id` via existing paths

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Current Structure:**
- `id: uuid` (primary key)
- `order_id: uuid | null` (nullable, references `public.orders(id)` on delete set null) - **backward compatibility field**
- `invoice_number: text` (unique, not null)
- `customer_name: text` (not null)
- `amount: decimal(10,2)` (not null)
- `status: text` (default 'pending', check constraint)
- `due_date: date` (not null)
- `issue_date: date` (default current_date)
- `payment_method: text` (nullable)
- `payment_date: date` (nullable)
- `notes: text` (nullable)
- `created_at: timestamptz` (default now())
- `updated_at: timestamptz` (default now())

**Foreign Keys:**
- `order_id` → `public.orders(id)` (nullable, on delete set null) ✅ EXISTS (backward compatibility)

**Observations:**
- Invoices table has `order_id` field (old relationship direction)
- This field is kept for backward compatibility
- Invoices can exist without orders

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id: uuid` (primary key)
- `invoice_id: uuid | null` (nullable, references `public.invoices(id)` on delete set null) ✅ EXISTS
- `customer_name: text` (not null)
- `customer_email: text` (nullable)
- `customer_phone: text` (nullable)
- `order_type: text` (not null)
- `sku: text` (nullable)
- `material: text` (nullable)
- `color: text` (nullable)
- `stone_status: text` (default 'NA', check constraint)
- `permit_status: text` (default 'pending', check constraint)
- `proof_status: text` (default 'Not_Received', check constraint)
- `deposit_date: date` (nullable)
- `second_payment_date: date` (nullable)
- `due_date: date` (nullable)
- `installation_date: date` (nullable)
- `location: text` (nullable)
- `value: decimal(10,2)` (nullable)
- `progress: integer` (default 0, check 0-100)
- `assigned_to: text` (nullable)
- `priority: text` (default 'medium', check constraint)
- `timeline_weeks: integer` (default 12)
- `notes: text` (nullable)
- `created_at: timestamptz` (default now())
- `updated_at: timestamptz` (default now())

**Foreign Keys:**
- `invoice_id` → `public.invoices(id)` (nullable, on delete set null) ✅ EXISTS

**Indexes:**
- `idx_orders_invoice_id` on `invoice_id` ✅ EXISTS

**Observations:**
- Orders table has `invoice_id` column (new relationship direction)
- Column is nullable (orders can exist without invoices for backward compatibility)
- Index exists for efficient querying of orders by invoice

### Relationship Analysis

**Current Relationship:**
- Primary: `orders.invoice_id` → `invoices.id` (nullable, on delete set null) ✅ EXISTS
- Legacy: `invoices.order_id` → `orders.id` (nullable, kept for backward compatibility)
- **Architectural direction:** Orders reference Invoices (Invoices are the spine)

**Gaps/Issues:**
1. **No Invoice Detail Page:**
   - `InvoicingPage.tsx` shows invoices in a table view only
   - "Eye" button exists but is not functional (no detail view implementation)
   - Cannot view or manage orders from an invoice context

2. **No Invoice-Scoped Order Creation:**
   - Orders can only be created via `CreateOrderDrawer` from Orders module
   - No way to create an order with `invoice_id` pre-filled from Invoice context
   - No UI path that establishes the invoice-order relationship at creation time

3. **No Orders Display in Invoice Context:**
   - Cannot see which orders belong to an invoice
   - No query function exists to fetch orders by `invoice_id`
   - No UI component to display orders for a selected invoice

### Data Access Patterns

**How Invoices are Currently Accessed:**

**Location:** `src/modules/invoicing/api/invoicing.api.ts`, `src/modules/invoicing/hooks/useInvoices.ts`

- `fetchInvoices()` - Fetches all invoices
- `fetchInvoice(id)` - Fetches single invoice by ID
- `createInvoice(invoice)` - Creates new invoice
- `updateInvoice(id, updates)` - Updates invoice
- `deleteInvoice(id)` - Deletes invoice

**Current Filters/Sorting:**
- No order-related queries (no `fetchOrdersByInvoice` function exists yet)

**How Orders are Currently Accessed:**

**Location:** `src/modules/orders/api/orders.api.ts`, `src/modules/orders/hooks/useOrders.ts`

- `fetchOrders()` - Fetches all orders
- `fetchOrder(id)` - Fetches single order by ID
- `createOrder(order)` - Creates new order
- `updateOrder(id, updates)` - Updates order
- `deleteOrder(id)` - Deletes order

**Current Filters/Sorting:**
- No invoice-related queries (no `fetchOrdersByInvoice` function exists yet)

**How They Are Queried Together:**
- Currently **not** queried together: No function to fetch orders by invoice_id
- The relationship exists in the database but is not exposed via data access layer

**Display Logic:**
- `InvoicingPage.tsx`: Shows invoices in table format with placeholder "Eye" button
- No Invoice detail view exists
- No Orders section in Invoice context
- `CreateOrderDrawer`: Creates orders without invoice context

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **None.** All necessary schema changes already exist (`orders.invoice_id` column and foreign key).

**Non-Destructive Constraints:**
- No new columns, tables, or indexes required.
- Existing `orders.invoice_id` relationship is sufficient.
- `invoices.order_id` remains unchanged (backward compatibility).

### Query/Data-Access Alignment

**Recommended Query Patterns:**

1. **Fetch Orders by Invoice ID:**
   ```typescript
   // Add to src/modules/orders/api/orders.api.ts
   export async function fetchOrdersByInvoice(invoiceId: string) {
     const { data, error } = await supabase
       .from('orders')
       .select('*')
       .eq('invoice_id', invoiceId)
       .order('created_at', { ascending: false });
     
     if (error) throw error;
     return data as Order[];
   }
   ```

2. **Create Order with Invoice Context:**
   ```typescript
   // Existing createOrder function will automatically work
   // Just need to pass invoice_id in OrderInsert data
   createOrder({
     ...orderData,
     invoice_id: invoiceId,  // Pre-filled from Invoice context
   });
   ```

**Recommended Display Patterns:**

1. **Invoice Detail View (New):**
   - Create `InvoiceDetailSidebar` or `InvoiceDetailDrawer` component
   - Display invoice information (customer, amount, status, dates, etc.)
   - Add "Orders" section showing orders belonging to this invoice
   - Add "Add Order" button/action

2. **Orders Section in Invoice Detail:**
   - Display list of orders where `order.invoice_id === invoice.id`
   - Show order summary: customer name, order type, status, value
   - Allow navigation to order detail
   - Show empty state when no orders exist

3. **Add Order from Invoice:**
   - "Add Order" button opens `CreateOrderDrawer` with `invoice_id` pre-filled
   - Order form should pre-populate `invoice_id` field (hidden or disabled)
   - On submit, order is created with `invoice_id` set automatically

---

## Implementation Approach

### Phase 1: Data Access Layer

**Step 1.1: Add fetchOrdersByInvoice Query Function**
- Add `fetchOrdersByInvoice(invoiceId)` to `src/modules/orders/api/orders.api.ts`
- Add `useOrdersByInvoice(invoiceId)` hook to `src/modules/orders/hooks/useOrders.ts`
- Add query key: `ordersKeys.byInvoice(invoiceId)`

**Purpose:** Enable fetching orders scoped to an invoice

### Phase 2: Invoice Detail View

**Step 2.1: Create Invoice Detail Component**
- Create `InvoiceDetailSidebar` or `InvoiceDetailDrawer` component
- Display invoice information (similar to `OrderDetailsSidebar` pattern)
- Wire up "Eye" button in `InvoicingPage.tsx` to open detail view

**Step 2.2: Add Orders Section to Invoice Detail**
- Add "Orders" card/section to Invoice detail component
- Use `useOrdersByInvoice(invoiceId)` to fetch orders
- Display orders list with key information (customer, type, status, value)
- Show loading and empty states

### Phase 3: Invoice-Centric Order Creation

**Step 3.1: Modify CreateOrderDrawer for Invoice Context**
- Accept optional `invoiceId` prop in `CreateOrderDrawer`
- Pre-populate `invoice_id` field when `invoiceId` is provided
- Hide or disable `invoice_id` field in form (pre-filled, not user-editable)

**Step 3.2: Add "Add Order" Action in Invoice Detail**
- Add "Add Order" button in Invoice detail Orders section
- Button opens `CreateOrderDrawer` with `invoiceId` prop set
- On successful order creation, refresh orders list in Invoice detail

### Safety Considerations

**Backward Compatibility:**
- Existing order creation paths remain unchanged (Orders module continues to work)
- `CreateOrderDrawer` works with or without `invoiceId` prop
- Orders can still be created without `invoice_id` (nullable column)

**Data Integrity:**
- When creating order from Invoice context, `invoice_id` is automatically set
- Cannot create invalid invoice-order relationships (foreign key constraint enforces)

**UI/UX:**
- Invoice detail view is additive (doesn't modify existing invoice table view)
- Existing invoice actions (edit, delete, etc.) continue to work
- Orders section is read-only display initially (no edit/delete from invoice context)

---

## What NOT to Do

- ❌ Do NOT remove `invoices.order_id` (keep for backward compatibility)
- ❌ Do NOT modify existing order creation paths in Orders module
- ❌ Do NOT make `invoice_id` required/not null
- ❌ Do NOT add schema changes or migrations
- ❌ Do NOT modify Jobs UI, Payments, Reporting, Inbox, Messages, or Notifications
- ❌ Do NOT change existing invoice table/list view (only add detail view)
- ❌ Do NOT add order editing/deletion from invoice context (keep read-only for now)

---

## Open Questions / Considerations

1. **Invoice Detail UI Pattern:**
   - Should it be a sidebar (like `OrderDetailsSidebar`) or a drawer/modal?
   - Recommendation: Use sidebar for consistency with Orders module

2. **Order Creation Form:**
   - Should `invoice_id` field be visible (disabled) or hidden when pre-filled?
   - Recommendation: Hidden field (user doesn't need to see it when creating from invoice)

3. **Orders List in Invoice Detail:**
   - Should orders be editable/deletable from invoice context, or read-only?
   - Decision: Read-only for this phase (can navigate to order detail for editing)

4. **Navigation:**
   - Should clicking an order in Invoice detail navigate to Orders page with order selected?
   - Or should it open Order detail sidebar in the Invoice context?

5. **Empty State:**
   - What should the Orders section show when invoice has no orders?
   - Should "Add Order" button be prominent in empty state?

---

## Success Criteria

- ✅ `fetchOrdersByInvoice()` function exists in orders API
- ✅ `useOrdersByInvoice()` hook exists and works correctly
- ✅ Invoice detail view/component exists and displays invoice information
- ✅ Orders section in Invoice detail shows orders for the selected invoice
- ✅ "Add Order" button exists in Invoice detail Orders section
- ✅ Creating order from Invoice context automatically sets `invoice_id`
- ✅ Existing order creation paths continue to work (backward compatibility)
- ✅ No schema changes or migrations required
- ✅ No changes to Jobs, Payments, Reporting, Inbox, Messages, or Notifications modules

