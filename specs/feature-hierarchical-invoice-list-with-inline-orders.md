# Hierarchical Invoice List with Inline Orders

## Overview

Transform the Invoicing module to display Orders as child rows directly under their parent Invoice, creating a clear invoice-centric workflow view. This hierarchical structure makes Invoices the primary organizational unit, with Orders visually and functionally subordinate to their Invoice.

**Context:**
- Invoices are established as the architectural spine (via `orders.invoice_id` foreign key)
- Invoice-centric order creation already exists (orders can be created with `invoice_id` pre-filled)
- Invoice detail sidebar exists but requires navigation away from the list view
- Current invoice list shows invoices in a flat table with no indication of related orders
- Orders module remains separate and unchanged (out of scope)

**Goal:**
- Make Invoices the primary workflow view by displaying related Orders inline
- Enable expand/collapse per invoice to reveal its orders
- Provide order management (create, edit, delete) directly from the invoice list view
- Establish clear visual hierarchy: Invoice (parent) → Orders (children)
- Maintain all existing functionality while adding this new interaction pattern

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Current Structure:**
- `id: uuid` (primary key)
- `order_id: uuid | null` (nullable, references `public.orders(id)` on delete set null) - **legacy backward compatibility field**
- `invoice_number: text` (unique, not null)
- `customer_name: text` (not null)
- `amount: decimal(10,2)` (not null)
- `status: text` (default 'pending', check constraint: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled')
- `due_date: date` (not null)
- `issue_date: date` (default current_date)
- `payment_method: text` (nullable)
- `payment_date: date` (nullable)
- `notes: text` (nullable)
- `created_at: timestamptz` (default now())
- `updated_at: timestamptz` (default now())

**Foreign Keys:**
- `order_id` → `public.orders(id)` (nullable, on delete set null) ✅ EXISTS (backward compatibility, legacy direction)

**Observations:**
- Invoices table has `order_id` field (old relationship direction, kept for backward compatibility)
- Invoices can exist without orders
- Invoice schema supports the hierarchical model (one invoice, many orders via `orders.invoice_id`)

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
- Orders table has `invoice_id` column (current relationship direction, invoices as spine)
- Column is nullable (orders can exist without invoices for backward compatibility)
- Index exists for efficient querying of orders by invoice
- Schema fully supports the hierarchical model

### Relationship Analysis

**Current Relationship:**
- Primary: `orders.invoice_id` → `invoices.id` (nullable, on delete set null) ✅ EXISTS
- Legacy: `invoices.order_id` → `orders.id` (nullable, kept for backward compatibility)
- **Architectural direction:** Orders reference Invoices (Invoices are the spine)

**Gaps/Issues:**
1. **No Hierarchical Display:**
   - Invoice list (`InvoicingPage.tsx`) shows invoices in a flat table
   - No indication that invoices have related orders
   - Must navigate to Invoice detail sidebar to see orders
   - No inline order management from invoice list

2. **No Expand/Collapse UI:**
   - No way to expand an invoice row to reveal its orders
   - No visual hierarchy in the list view
   - Orders are not accessible without leaving the list context

3. **Limited Order Context:**
   - Orders are only visible in Invoice detail sidebar (separate view)
   - Cannot see invoice and orders together in the same context
   - Order creation requires opening detail sidebar, then drawer

### Data Access Patterns

**How Invoices are Currently Accessed:**

**Location:** `src/modules/invoicing/api/invoicing.api.ts`, `src/modules/invoicing/hooks/useInvoices.ts`

- `fetchInvoices()` - Fetches all invoices
- `fetchInvoice(id)` - Fetches single invoice by ID
- `createInvoice(invoice)` - Creates new invoice
- `updateInvoice(id, updates)` - Updates invoice
- `deleteInvoice(id)` - Deletes invoice

**Current Display Logic:**
- `InvoicingPage.tsx`: Shows invoices in flat table format
- Invoice rows display: invoice number, customer, amount, status, due date, payment method
- Actions: Edit, Delete, View (opens sidebar), Send, Download (placeholders)

**How Orders are Currently Accessed:**

**Location:** `src/modules/orders/api/orders.api.ts`, `src/modules/orders/hooks/useOrders.ts`

- `fetchOrders()` - Fetches all orders
- `fetchOrder(id)` - Fetches single order by ID
- `fetchOrdersByInvoice(invoiceId)` - Fetches orders for a specific invoice ✅ EXISTS
- `createOrder(order)` - Creates new order (supports `invoice_id` in OrderInsert)
- `updateOrder(id, updates)` - Updates order
- `deleteOrder(id)` - Deletes order

**React Query Hooks:**
- `useOrdersList()` - Fetches all orders
- `useOrder(id)` - Fetches single order
- `useOrdersByInvoice(invoiceId)` - Fetches orders by invoice ✅ EXISTS

**Current Display Logic:**
- Orders are displayed in separate Orders module
- Orders can be displayed in Invoice detail sidebar (via `useOrdersByInvoice`)
- Orders can be created from Invoice context (via `CreateOrderDrawer` with `invoiceId` prop)

**How They Are Queried Together:**
- `fetchOrdersByInvoice(invoiceId)` already exists and is used in Invoice detail sidebar
- Orders are queried per-invoice when invoice is expanded (not pre-fetched for all invoices)
- This pattern should be reused for inline order display

**Display Logic:**
- Invoice detail sidebar (`InvoiceDetailSidebar.tsx`) uses `useOrdersByInvoice` to fetch and display orders
- Order creation from invoice uses `CreateOrderDrawer` with `invoiceId` prop
- No inline/hierarchical display in invoice list yet

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **None.** All necessary schema changes already exist (`orders.invoice_id` column, foreign key, and index).

**Non-Destructive Constraints:**
- No new columns, tables, or indexes required.
- Existing `orders.invoice_id` relationship is sufficient.
- `invoices.order_id` remains unchanged (backward compatibility).
- Schema already supports one-to-many: Invoice → Orders

### Query/Data-Access Alignment

**Recommended Query Patterns:**

1. **Per-Invoice Order Fetching (Existing Pattern):**
   - Use existing `fetchOrdersByInvoice(invoiceId)` function
   - Use existing `useOrdersByInvoice(invoiceId)` React Query hook
   - Fetch orders only when invoice is expanded (on-demand, not pre-fetched)
   - This minimizes initial load and supports lazy loading

2. **Order Creation from Invoice Context (Existing Pattern):**
   - Use existing `CreateOrderDrawer` component with `invoiceId` prop
   - Order data automatically includes `invoice_id: invoiceId`
   - React Query cache invalidation already handles refreshing invoice-scoped queries

3. **Order Editing/Deletion (Existing Patterns):**
   - Reuse existing `EditOrderDrawer` component
   - Reuse existing `DeleteOrderDialog` component
   - Reuse existing `useUpdateOrder` and `useDeleteOrder` hooks
   - These mutations already invalidate appropriate query caches

**Recommended Display Patterns:**

1. **Expand/Collapse UI:**
   - Add expand/collapse caret icon to first column of invoice table row
   - Track expansion state per invoice ID in component state (Set<string> or Record<string, boolean>)
   - Visual indicator (chevron icon) rotates/flips when expanded
   - Expanded state is local UI state (no persistence needed)

2. **Child Row Rendering:**
   - When invoice is expanded, render child rows immediately following the invoice row
   - Child rows are visually indented/nested (padding-left or background color differentiation)
   - Child rows display order summary: customer name, order type, status, value
   - Each child row has actions: Edit, Delete (reuse existing components/handlers)

3. **Loading and Empty States:**
   - Show loading spinner/text in expanded section while `useOrdersByInvoice` is loading
   - Show empty state message when invoice has no orders
   - Show error state if order fetch fails (per-invoice error handling)

4. **Add Order Action:**
   - "+ Add Order" button appears in expanded section (below order list or in empty state)
   - Opens `CreateOrderDrawer` with `invoiceId` prop pre-filled
   - On successful creation, orders list refreshes automatically (via React Query cache invalidation)

---

## Implementation Approach

### Phase 1: Expand/Collapse Infrastructure

**Step 1.1: Add Expansion State Management**
- Add state to track expanded invoice IDs: `const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());`
- Add toggle function: `const toggleInvoiceExpansion = (invoiceId: string) => { ... }`
- Handle expansion state changes (add/remove invoice ID from Set)

**Step 1.2: Add Expand/Collapse UI Element**
- Add expand/collapse caret icon (ChevronRight/ChevronDown from lucide-react) to first table cell of invoice row
- Icon toggles based on expansion state
- Clicking caret toggles expansion (calls toggle function)

**Purpose:** Enable basic expand/collapse functionality before adding order display

### Phase 2: Inline Order Display

**Step 2.1: Conditionally Fetch Orders for Expanded Invoices**
- For each invoice row, conditionally call `useOrdersByInvoice` only when invoice is expanded
- Use `enabled` option in useQuery: `enabled: expandedInvoices.has(invoice.id)`
- Handle loading, error, and empty states per expanded invoice

**Step 2.2: Render Order Child Rows**
- When invoice is expanded and orders are loaded, render child rows after invoice row
- Use conditional rendering: `{expandedInvoices.has(invoice.id) && ordersData && ...}`
- Child rows are visually nested (padding-left, different background, or border-left indicator)
- Display order summary fields: customer name, order type, status badge, value
- Order rows use same table structure but with nested styling

**Step 2.3: Handle Loading and Empty States**
- Show loading state in expanded section: "Loading orders..." text or spinner
- Show empty state: "No orders for this invoice" message
- Show error state: "Unable to load orders" with retry option (optional)

**Purpose:** Display orders as child rows under their parent invoice

### Phase 3: Order Management Actions

**Step 3.1: Add "Add Order" Action**
- Add "+ Add Order" button in expanded invoice section
- Button appears below order list (or in empty state prominently)
- Opens `CreateOrderDrawer` with `invoiceId={invoice.id}` prop
- Manage drawer open/close state per invoice (or single global state)

**Step 3.2: Add Edit Order Action**
- Add Edit button/icon to each order child row
- Opens existing `EditOrderDrawer` component (reuse from Orders module)
- Edit functionality works the same as in Orders module
- On successful edit, orders list refreshes automatically (via React Query)

**Step 3.3: Add Delete Order Action**
- Add Delete button/icon to each order child row
- Opens existing `DeleteOrderDialog` component (reuse from Orders module)
- Delete functionality works the same as in Orders module
- On successful delete, orders list refreshes automatically (via React Query)

**Purpose:** Enable full order CRUD operations from invoice list view

### Phase 4: Visual Polish and UX Refinement

**Step 4.1: Visual Hierarchy Styling**
- Ensure child rows are clearly visually subordinate (indentation, background color, border)
- Maintain hover states for both invoice and order rows
- Ensure expand/collapse animation is smooth (if using CSS transitions)

**Step 4.2: Responsive Behavior**
- Ensure expand/collapse works on mobile/tablet viewports
- Consider stacked layout for small screens (if current table is responsive)

**Step 4.3: Keyboard Navigation (Optional)**
- Ensure expand/collapse can be triggered with keyboard (Enter/Space on invoice row)
- Maintain accessibility (ARIA attributes for expand/collapse state)

**Purpose:** Ensure feature is polished and production-ready

### Safety Considerations

**Backward Compatibility:**
- All existing invoice list functionality remains unchanged when invoices are not expanded
- Invoice detail sidebar continues to work as before
- Orders module remains completely unchanged
- Existing order creation paths (from Orders module) continue to work

**Data Integrity:**
- Orders created from invoice context automatically have `invoice_id` set (via existing `CreateOrderDrawer` logic)
- Order editing/deletion works the same as in Orders module (no special handling needed)
- React Query cache invalidation ensures data consistency

**Performance:**
- Orders are fetched on-demand (only when invoice is expanded)
- No pre-fetching of all orders for all invoices (scales well)
- React Query caching prevents redundant fetches
- Multiple invoices can be expanded simultaneously (each fetches independently)

**Error Handling:**
- Per-invoice error handling (one invoice's order fetch failure doesn't affect others)
- Graceful degradation (if order fetch fails, show error state but keep invoice row functional)

---

## What NOT to Do

- ❌ Do NOT modify the Orders module list view (it remains separate and unchanged)
- ❌ Do NOT change the Orders module structure or grouping
- ❌ Do NOT add schema changes or migrations
- ❌ Do NOT modify Jobs UI, Payments UI, Reporting, Inbox, Messages, or Notifications
- ❌ Do NOT enforce `orders.invoice_id` NOT NULL (keep nullable for backward compatibility)
- ❌ Do NOT remove legacy Order creation paths (Orders module continues to work)
- ❌ Do NOT pre-fetch orders for all invoices (only fetch when expanded)
- ❌ Do NOT persist expansion state (local UI state only, resets on page reload)
- ❌ Do NOT modify existing invoice actions (Edit, Delete, View sidebar, etc.)
- ❌ Do NOT change the Invoice detail sidebar (it continues to exist alongside this feature)
- ❌ Do NOT show orders without `invoice_id` in the expanded invoice view (filter them out)

---

## Open Questions / Considerations

1. **Visual Design:**
   - How much indentation for child rows? (Recommendation: 2-3rem padding-left)
   - Should child rows have different background color? (Recommendation: Slightly lighter/darker than parent)
   - Should there be a connecting line/indicator between parent and child? (Recommendation: Border-left or subtle line)

2. **Multiple Expansion:**
   - Can multiple invoices be expanded simultaneously? (Decision: Yes, for flexibility)
   - Should there be an "Expand All" / "Collapse All" action? (Out of scope for initial implementation)

3. **Order Row Actions:**
   - Should order rows have the same actions as invoice rows? (Decision: Edit and Delete only, no View)
   - Should clicking an order row navigate to order detail? (Decision: No navigation, Edit opens drawer instead)

4. **Performance:**
   - What if an invoice has 50+ orders? (Consideration: Current implementation should handle this, but may need pagination in future)
   - Should there be a limit on expanded invoices? (Decision: No limit for initial implementation)

5. **Empty State:**
   - Should "+ Add Order" button be prominent in empty state? (Decision: Yes, make it the primary action)
   - Should empty state show any instructional text? (Decision: "No orders yet. Click 'Add Order' to create one.")

6. **Order Display Fields:**
   - Which order fields should be shown in child rows? (Decision: Customer name, Order type, Status badge, Value - keep it minimal)
   - Should order rows be sortable/filterable? (Out of scope for initial implementation)

---

## Success Criteria

- ✅ Invoices can be expanded to reveal related orders as child rows
- ✅ Expand/collapse state is visually clear (caret icon, nested styling)
- ✅ Orders are fetched on-demand when invoice is expanded (not pre-fetched)
- ✅ Loading, empty, and error states are handled per expanded invoice
- ✅ "+ Add Order" button exists in expanded invoice section
- ✅ Orders can be created from invoice context with `invoice_id` automatically set
- ✅ Orders can be edited from invoice context (reuses EditOrderDrawer)
- ✅ Orders can be deleted from invoice context (reuses DeleteOrderDialog)
- ✅ All existing invoice list functionality remains unchanged
- ✅ Invoice detail sidebar continues to work as before
- ✅ Orders module remains completely unchanged
- ✅ Feature is visually obvious and demoable to client

