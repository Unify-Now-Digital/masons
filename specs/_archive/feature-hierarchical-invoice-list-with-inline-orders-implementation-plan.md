# Hierarchical Invoice List with Inline Orders - Implementation Plan

## Overview

This plan implements a hierarchical invoice list where Orders are displayed as child rows directly under their parent Invoice. The implementation adds expand/collapse functionality to invoice rows, fetches orders on-demand when expanded, and provides full order management (create, edit, delete) directly from the invoice list view.

**Feature Specification:** `specs/feature-hierarchical-invoice-list-with-inline-orders.md`

**Constraints:**
- No schema changes (database already supports `orders.invoice_id`)
- No changes to Orders module
- No Jobs, Payments, Reporting, Inbox, Messages changes
- Maintain backward compatibility with all existing functionality

---

## Implementation Phases

### Phase 1: Expand/Collapse Infrastructure

#### Task 1.1: Add Expansion State Management

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
1. Add state to track expanded invoice IDs:
   ```typescript
   const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
   ```

2. Add toggle function:
   ```typescript
   const toggleInvoiceExpansion = (invoiceId: string) => {
     setExpandedInvoices(prev => {
       const next = new Set(prev);
       if (next.has(invoiceId)) {
         next.delete(invoiceId);
       } else {
         next.add(invoiceId);
       }
       return next;
     });
   };
   ```

**Purpose:** Track which invoices are expanded for conditional rendering and data fetching

**Validation:**
- State is properly initialized as empty Set
- Toggle function correctly adds/removes invoice IDs
- State updates trigger re-renders correctly

---

#### Task 1.2: Add Expand/Collapse UI Element

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
1. Import chevron icons:
   ```typescript
   import { ChevronRight, ChevronDown } from 'lucide-react';
   ```

2. Add expand/collapse caret to first table cell (Invoice Number column):
   - Add new `TableHead` column at the start: `<TableHead className="w-12"></TableHead>`
   - In invoice row, add first `TableCell` with caret icon:
     ```typescript
     <TableCell>
       <Button
         variant="ghost"
         size="sm"
         className="h-6 w-6 p-0"
         onClick={(e) => {
           e.stopPropagation();
           toggleInvoiceExpansion(invoice.id);
         }}
       >
         {expandedInvoices.has(invoice.id) ? (
           <ChevronDown className="h-4 w-4" />
         ) : (
           <ChevronRight className="h-4 w-4" />
         )}
       </Button>
     </TableCell>
     ```

**Purpose:** Provide visual indicator and interaction for expanding/collapsing invoice rows

**Validation:**
- Caret icon appears in first column of each invoice row
- Icon changes from ChevronRight (collapsed) to ChevronDown (expanded)
- Clicking caret toggles expansion state
- Click event doesn't bubble to table row click handlers

---

### Phase 2: Inline Order Display

#### Task 2.1: Create Expanded Invoice Content Component

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx` (new file)

**Component Structure:**
- Accepts `invoiceId: string` prop
- Uses `useOrdersByInvoice(invoiceId)` hook to fetch orders
- Handles loading, error, and empty states
- Renders order list or appropriate state message

**Code Pattern:**
```typescript
import React from 'react';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import { Badge } from '@/shared/components/ui/badge';
import type { Order } from '@/modules/orders/types/orders.types';

interface ExpandedInvoiceOrdersProps {
  invoiceId: string;
}

export const ExpandedInvoiceOrders: React.FC<ExpandedInvoiceOrdersProps> = ({ invoiceId }) => {
  const { data: orders, isLoading, isError } = useOrdersByInvoice(invoiceId);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <tr>
        <td colSpan={8} className="p-4 text-center text-sm text-muted-foreground bg-slate-50">
          Loading orders...
        </td>
      </tr>
    );
  }

  if (isError) {
    return (
      <tr>
        <td colSpan={8} className="p-4 text-center text-sm text-red-600 bg-slate-50">
          Unable to load orders
        </td>
      </tr>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <tr>
        <td colSpan={8} className="p-4 text-center text-sm text-muted-foreground bg-slate-50">
          No orders for this invoice
        </td>
      </tr>
    );
  }

  return (
    <>
      {orders.map((order) => (
        <tr key={order.id} className="bg-slate-50 hover:bg-slate-100">
          <TableCell className="pl-12 border-l-2 border-blue-200"></TableCell>
          <TableCell className="pl-4">
            <div className="font-medium">{order.customer_name}</div>
            <div className="text-xs text-muted-foreground">{order.order_type}</div>
          </TableCell>
          {/* Additional order fields as needed */}
        </tr>
      ))}
    </>
  );
};
```

**Purpose:** Encapsulate order fetching and rendering logic for expanded invoices

**Validation:**
- Component renders loading state when fetching
- Component renders error state on fetch failure
- Component renders empty state when no orders
- Component renders order list when orders exist
- Orders are properly formatted and displayed

---

#### Task 2.2: Integrate Expanded Content into Invoice Table

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
1. Import `ExpandedInvoiceOrders` component

2. Modify invoice row rendering to conditionally include expanded content:
   ```typescript
   {filteredInvoices.map((invoice) => (
     <React.Fragment key={invoice.id}>
       <TableRow className="hover:bg-slate-50">
         {/* Existing invoice row cells */}
       </TableRow>
       {expandedInvoices.has(invoice.id) && (
         <ExpandedInvoiceOrders invoiceId={invoice.id} />
       )}
     </React.Fragment>
   ))}
   ```

3. Adjust table structure to accommodate child rows:
   - Ensure column count matches between header and rows
   - Child rows should span all columns or use appropriate column layout

**Purpose:** Display orders as child rows when invoice is expanded

**Validation:**
- Child rows appear immediately after parent invoice row when expanded
- Child rows disappear when invoice is collapsed
- Multiple invoices can be expanded simultaneously
- Table structure remains valid (no broken layouts)

---

#### Task 2.3: Style Child Rows for Visual Hierarchy

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

**Changes:**
1. Add visual indentation and styling:
   - Left padding to indent child rows: `pl-12` or `pl-16`
   - Border-left indicator: `border-l-2 border-blue-200`
   - Background color differentiation: `bg-slate-50`
   - Hover state: `hover:bg-slate-100`

2. Display order summary fields:
   - Customer name (font-medium)
   - Order type (smaller, muted text)
   - Order value (formatted currency)
   - Status badge (if applicable)

**Visual Design Decisions:**
- Indentation: 3rem (48px) from left edge
- Background: Slightly lighter than invoice rows (`bg-slate-50` vs default)
- Border: Left border (2px, blue-200) to indicate hierarchy
- Typography: Smaller font size for order type/subtitle

**Purpose:** Make child rows clearly visually subordinate to parent invoice rows

**Validation:**
- Child rows are visually distinct from parent rows
- Hierarchy is immediately obvious to users
- Styling is consistent across all child rows
- Hover states work correctly

---

### Phase 3: Order Management Actions

#### Task 3.1: Add "Add Order" Action

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

**Changes:**
1. Add state for drawer:
   ```typescript
   const [createOrderDrawerOpen, setCreateOrderDrawerOpen] = useState(false);
   ```

2. Import `CreateOrderDrawer` component

3. Add "+ Add Order" button in empty state and after order list:
   ```typescript
   // In empty state
   <tr>
     <td colSpan={8} className="p-4 text-center bg-slate-50">
       <div className="space-y-2">
         <p className="text-sm text-muted-foreground">No orders yet. Click 'Add Order' to create one.</p>
         <Button
           size="sm"
           onClick={() => setCreateOrderDrawerOpen(true)}
         >
           <Plus className="h-4 w-4 mr-2" />
           Add Order
         </Button>
       </div>
     </td>
   </tr>

   // After order list
   <tr>
     <td colSpan={8} className="p-4 bg-slate-50">
       <Button
         size="sm"
         variant="outline"
         onClick={() => setCreateOrderDrawerOpen(true)}
       >
         <Plus className="h-4 w-4 mr-2" />
         Add Order
       </Button>
     </td>
   </tr>
   ```

4. Render `CreateOrderDrawer`:
   ```typescript
   <CreateOrderDrawer
     open={createOrderDrawerOpen}
     onOpenChange={setCreateOrderDrawerOpen}
     invoiceId={invoiceId}
   />
   ```

**Note:** Consider moving drawer state to parent component if multiple invoices can have drawers open simultaneously, or use a single global drawer state.

**Purpose:** Enable order creation from invoice context

**Validation:**
- "+ Add Order" button appears in empty state
- "+ Add Order" button appears after order list
- Clicking button opens CreateOrderDrawer
- Drawer receives correct `invoiceId` prop
- Order is created with `invoice_id` set automatically
- Orders list refreshes after creation

---

#### Task 3.2: Add Edit Order Action

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

**Changes:**
1. Add state for edit drawer:
   ```typescript
   const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
   const [editDrawerOpen, setEditDrawerOpen] = useState(false);
   ```

2. Import `EditOrderDrawer` component and `Order` type

3. Add Edit button to each order row:
   ```typescript
   <TableCell>
     <Button
       variant="outline"
       size="sm"
       onClick={() => {
         setOrderToEdit(order);
         setEditDrawerOpen(true);
       }}
     >
       <Edit className="h-3 w-3" />
     </Button>
   </TableCell>
   ```

4. Render `EditOrderDrawer`:
   ```typescript
   {orderToEdit && (
     <EditOrderDrawer
       open={editDrawerOpen}
       onOpenChange={(open) => {
         setEditDrawerOpen(open);
         if (!open) setOrderToEdit(null);
       }}
       order={orderToEdit}
     />
   )}
   ```

**Purpose:** Enable order editing from invoice context

**Validation:**
- Edit button appears on each order row
- Clicking Edit opens EditOrderDrawer with correct order
- Order can be edited and saved
- Orders list refreshes after edit (via React Query cache invalidation)

---

#### Task 3.3: Add Delete Order Action

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

**Changes:**
1. Add state for delete dialog:
   ```typescript
   const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   ```

2. Import `DeleteOrderDialog` component

3. Add Delete button to each order row:
   ```typescript
   <TableCell>
     <Button
       variant="outline"
       size="sm"
       className="text-red-600 hover:text-red-700 hover:bg-red-50"
       onClick={() => {
         setOrderToDelete(order);
         setDeleteDialogOpen(true);
       }}
     >
       <Trash2 className="h-3 w-3" />
     </Button>
   </TableCell>
   ```

4. Render `DeleteOrderDialog`:
   ```typescript
   {orderToDelete && (
     <DeleteOrderDialog
       open={deleteDialogOpen}
       onOpenChange={(open) => {
         setDeleteDialogOpen(open);
         if (!open) setOrderToDelete(null);
       }}
       order={orderToDelete}
     />
   )}
   ```

**Purpose:** Enable order deletion from invoice context

**Validation:**
- Delete button appears on each order row
- Clicking Delete opens DeleteOrderDialog with correct order
- Order can be deleted with confirmation
- Orders list refreshes after deletion (via React Query cache invalidation)

---

### Phase 4: Order Row Display Fields

#### Task 4.1: Determine Order Row Column Layout

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

**Decisions:**
- Order rows should align with invoice table columns where possible
- Display minimal but essential information: Customer, Order Type, Value, Status (if applicable), Actions

**Column Mapping:**
- Column 1: Empty (aligns with expand/collapse column)
- Column 2: Customer Name + Order Type (subtitle)
- Column 3: Order Value (formatted currency)
- Column 4: Order Status (optional badge)
- Column 5-7: Empty or additional order fields if needed
- Column 8: Actions (Edit, Delete buttons)

**Purpose:** Ensure order rows display key information while maintaining table alignment

**Validation:**
- Order rows align with invoice table structure
- Key order information is visible
- Layout is consistent and readable

---

#### Task 4.2: Add Order Status Display (Optional)

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

**Changes:**
- If order status is important for quick scanning, add status badge
- Use existing status color logic from Orders module
- Keep status display minimal (badge only, not full status details)

**Purpose:** Provide quick visual indicator of order status

**Validation:**
- Status badge displays correctly
- Colors are consistent with Orders module
- Badge doesn't clutter the row

---

### Phase 5: Backward Compatibility Verification

#### Task 5.1: Verify Existing Invoice List Functionality

**Files to Check:**
- `src/modules/invoicing/pages/InvoicingPage.tsx`

**Verification Steps:**
1. Invoice list displays correctly when no invoices are expanded
2. Invoice filtering (tabs, search) still works
3. Invoice actions (Edit, Delete, View sidebar, Send, Download) still work
4. Invoice stats cards still calculate correctly
5. No console errors or TypeScript errors

**Expected Behavior:**
- All existing invoice list functionality works exactly as before
- Expanding invoices doesn't break any existing features
- Invoice detail sidebar continues to work independently

---

#### Task 5.2: Verify Orders Module Unchanged

**Files to Check:**
- `src/modules/orders/pages/OrdersPage.tsx`
- `src/modules/orders/components/*`

**Verification Steps:**
1. Orders module still displays and functions correctly
2. Order creation from Orders module still works (without invoice_id)
3. Order editing from Orders module still works
4. Order deletion from Orders module still works
5. No changes to Orders module files

**Expected Behavior:**
- Orders module is completely unchanged
- All order functionality in Orders module works as before
- No side effects from invoice list changes

---

#### Task 5.3: Verify Invoice Detail Sidebar Unchanged

**Files to Check:**
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Verification Steps:**
1. Invoice detail sidebar still opens when Eye button is clicked
2. Orders section in sidebar still displays correctly
3. Order creation from sidebar still works
4. No conflicts between sidebar and inline order display

**Expected Behavior:**
- Invoice detail sidebar continues to work as before
- Both sidebar and inline views can coexist
- No conflicts or duplicate functionality issues

---

## File Summary

### New Files
- `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

### Modified Files
- `src/modules/invoicing/pages/InvoicingPage.tsx`

---

## Implementation Details

### State Management Strategy

**Expansion State:**
- Use `Set<string>` to track expanded invoice IDs
- Set operations are O(1) for add/remove/check
- State is local component state (not persisted)

**Drawer/Dialog State:**
- Can use single global state for drawers/dialogs (one open at a time)
- OR use per-invoice state if multiple invoices need drawers simultaneously
- Recommendation: Start with single global state, refactor if needed

### Data Fetching Strategy

**On-Demand Fetching:**
- Orders are fetched only when invoice is expanded
- Use `enabled` option in `useOrdersByInvoice` hook: `enabled: expandedInvoices.has(invoiceId)`
- React Query handles caching and prevents redundant fetches
- Multiple invoices can be expanded simultaneously (each fetches independently)

### Performance Considerations

**Lazy Loading:**
- Orders are not pre-fetched for all invoices
- Initial page load is fast (only invoices are fetched)
- Orders fetch on-demand when user expands invoice
- React Query cache prevents refetching if invoice is collapsed and re-expanded

**Scalability:**
- No performance issues with many invoices (only expanded ones fetch orders)
- No performance issues with invoices that have many orders (standard list rendering)
- Consider pagination for orders if invoices have 50+ orders (future enhancement)

---

## Testing Checklist

### Phase 1: Expand/Collapse
- [ ] Expand/collapse caret icon appears in first column
- [ ] Clicking caret expands/collapses invoice row
- [ ] Icon changes correctly (ChevronRight ↔ ChevronDown)
- [ ] Multiple invoices can be expanded simultaneously
- [ ] Expansion state is maintained until user collapses

### Phase 2: Order Display
- [ ] Orders load when invoice is expanded
- [ ] Loading state displays correctly
- [ ] Empty state displays when invoice has no orders
- [ ] Error state displays on fetch failure
- [ ] Order list displays correctly with all fields
- [ ] Child rows are visually distinct (indentation, background, border)

### Phase 3: Order Actions
- [ ] "+ Add Order" button appears in empty state
- [ ] "+ Add Order" button appears after order list
- [ ] CreateOrderDrawer opens with correct invoiceId
- [ ] Order is created with invoice_id set
- [ ] Orders list refreshes after creation
- [ ] Edit button appears on each order row
- [ ] EditOrderDrawer opens with correct order
- [ ] Order can be edited and saved
- [ ] Orders list refreshes after edit
- [ ] Delete button appears on each order row
- [ ] DeleteOrderDialog opens with correct order
- [ ] Order can be deleted with confirmation
- [ ] Orders list refreshes after deletion

### Phase 4: Backward Compatibility
- [ ] Invoice list works correctly when no invoices expanded
- [ ] Invoice filtering (tabs, search) still works
- [ ] Invoice actions (Edit, Delete, View sidebar) still work
- [ ] Invoice detail sidebar still works
- [ ] Orders module still works unchanged
- [ ] No TypeScript compilation errors
- [ ] No runtime errors in console

---

## Success Criteria

✅ **Expand/Collapse:**
- Invoices can be expanded to reveal orders as child rows
- Expand/collapse state is visually clear (caret icon, nested styling)
- Multiple invoices can be expanded simultaneously

✅ **Order Display:**
- Orders are fetched on-demand when invoice is expanded (not pre-fetched)
- Loading, empty, and error states are handled per expanded invoice
- Child rows are visually subordinate to parent invoice rows

✅ **Order Management:**
- "+ Add Order" button exists in expanded invoice section
- Orders can be created from invoice context with `invoice_id` automatically set
- Orders can be edited from invoice context (reuses EditOrderDrawer)
- Orders can be deleted from invoice context (reuses DeleteOrderDialog)
- All order actions refresh the orders list automatically

✅ **Backward Compatibility:**
- All existing invoice list functionality remains unchanged
- Invoice detail sidebar continues to work as before
- Orders module remains completely unchanged
- No breaking changes to any existing workflows

✅ **Code Quality:**
- No schema changes or migrations required
- Code follows existing patterns and conventions
- TypeScript compiles without errors
- Feature is visually obvious and demoable to client

---

## Implementation Order

1. **Phase 1** (Expand/Collapse): Complete first to enable basic interaction
2. **Phase 2** (Order Display): Complete next to show orders when expanded
3. **Phase 3** (Order Actions): Complete to enable full order management
4. **Phase 4** (Display Fields): Complete to polish order row display
5. **Phase 5** (Verification): Complete throughout and at end to ensure quality

---

## Notes

- **Pattern Consistency:** This implementation follows the existing pattern of reusing components (CreateOrderDrawer, EditOrderDrawer, DeleteOrderDialog) and hooks (useOrdersByInvoice)
- **UI/UX:** Hierarchical display makes invoice-order relationship immediately obvious
- **Performance:** On-demand fetching ensures fast initial load and efficient resource usage
- **Extensibility:** Future enhancements (pagination, sorting, filtering orders) can be added easily
- **Error Handling:** Per-invoice error handling ensures one invoice's failure doesn't affect others

