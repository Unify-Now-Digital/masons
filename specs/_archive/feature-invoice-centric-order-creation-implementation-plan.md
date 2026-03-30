# Invoice-Centric Order Creation - Implementation Plan

## Overview

This plan implements the invoice-centric order creation feature, allowing orders to be created in the context of an Invoice with automatic `invoice_id` assignment. The implementation follows the existing patterns from the Orders module (specifically `OrderDetailsSidebar`) for consistency.

**Feature Specification:** `specs/feature-invoice-centric-order-creation.md`

**Constraints:**
- No schema changes (database already supports `orders.invoice_id`)
- No Jobs UI changes
- No Payments changes
- No refactoring unrelated modules
- Maintain backward compatibility with existing order creation

---

## Implementation Phases

### Phase 1: Data Access Layer

#### Task 1.1: Add `fetchOrdersByInvoice` Query Function

**File:** `src/modules/orders/api/orders.api.ts`

**Changes:**
- Add new async function `fetchOrdersByInvoice(invoiceId: string)` that:
  - Queries `orders` table filtered by `invoice_id = invoiceId`
  - Orders by `created_at DESC` (newest first)
  - Returns `Order[]`
  - Throws errors for error handling

**Code Pattern:**
```typescript
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

**Validation:**
- TypeScript compiles without errors
- Function signature matches existing query patterns
- Error handling consistent with other fetch functions

---

#### Task 1.2: Add `useOrdersByInvoice` React Query Hook

**File:** `src/modules/orders/hooks/useOrders.ts`

**Changes:**
- Add query key: `ordersKeys.byInvoice(invoiceId: string)` to `ordersKeys` object
- Add new hook `useOrdersByInvoice(invoiceId: string | null | undefined)` that:
  - Uses `fetchOrdersByInvoice` as query function
  - Uses conditional `queryKey` (disabled key if `invoiceId` is falsy)
  - Enables query only when `invoiceId` is truthy
  - Returns standard React Query result

**Code Pattern:**
```typescript
export const ordersKeys = {
  all: ['orders'] as const,
  detail: (id: string) => ['orders', id] as const,
  byInvoice: (invoiceId: string) => ['orders', 'byInvoice', invoiceId] as const, // NEW
};

export function useOrdersByInvoice(invoiceId: string | null | undefined) {
  return useQuery({
    queryKey: invoiceId ? ordersKeys.byInvoice(invoiceId) : ['orders', 'byInvoice', 'disabled'],
    queryFn: () => fetchOrdersByInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
}
```

**Validation:**
- Hook follows same pattern as `useMessagesByOrder` (proven pattern in codebase)
- Query key structure prevents cache pollution with null values
- TypeScript types are correct

---

### Phase 2: Invoice Detail View Component

#### Task 2.1: Create `InvoiceDetailSidebar` Component

**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` (new file)

**Component Structure:**
- Fixed right-side sidebar (matching `OrderDetailsSidebar` pattern)
- Width: `w-96`, fixed positioning, scrollable content
- Close button (X icon) in header
- Displays invoice information in Card sections:
  - Invoice Details (invoice number, customer, amount, status, dates)
  - Payment Information (payment method, payment date)
  - Notes (if present)
  - **Orders Section** (see Task 2.2)

**Props Interface:**
```typescript
interface InvoiceDetailSidebarProps {
  invoice: Invoice | null;
  onClose: () => void;
}
```

**Pattern Reference:**
- Follow structure from `OrderDetailsSidebar.tsx` (lines 37-586)
- Use same UI components: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Badge`, `Button`
- Same layout patterns and spacing

**Validation:**
- Component renders correctly when `invoice` is provided
- Component returns `null` when `invoice` is `null`
- Close button calls `onClose` callback
- All invoice fields display correctly

---

#### Task 2.2: Add Orders Section to Invoice Detail

**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Orders Section Implementation:**
- Place after invoice details cards, before closing tag
- Use `useOrdersByInvoice(invoice?.id ?? null)` to fetch orders
- Display orders in a Card with:
  - CardHeader: "Orders" title
  - CardContent: Orders list or empty/loading state

**Loading State:**
- Show "Loading orders..." text when `isLoading === true`

**Empty State:**
- Show "No orders for this invoice" text when:
  - `!isLoading && (!orders || orders.length === 0)`

**Orders List:**
- Map over orders array
- Display each order in a border-rounded container with:
  - Customer name (from `order.customer_name`)
  - Order type (from `order.order_type`)
  - Status/priority badge (optional, based on order status)
  - Order value (from `order.value`, formatted as currency)
  - Clickable row (future: navigate to order detail)

**Code Pattern:**
```typescript
const { data: orders, isLoading: isOrdersLoading } = useOrdersByInvoice(invoice?.id ?? null);

// In JSX:
<Card className="mb-4">
  <CardHeader className="pb-3">
    <CardTitle className="text-base">Orders</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    {isOrdersLoading && (
      <p className="text-sm text-muted-foreground">Loading orders...</p>
    )}
    {!isOrdersLoading && (!orders || orders.length === 0) && (
      <p className="text-sm text-muted-foreground">No orders for this invoice</p>
    )}
    {!isOrdersLoading && orders && orders.length > 0 && (
      <div className="space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="border rounded-md p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{order.customer_name}</div>
                <div className="text-sm text-muted-foreground">{order.order_type}</div>
              </div>
              {order.value && (
                <div className="text-sm font-medium">
                  ${order.value.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

**Validation:**
- Loading state displays correctly
- Empty state displays when no orders
- Orders list renders when orders exist
- All order fields display correctly

---

#### Task 2.3: Wire Invoice Detail Sidebar to InvoicingPage

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
1. Import `InvoiceDetailSidebar` component
2. Add state for selected invoice:
   ```typescript
   const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
   ```
3. Wire "Eye" button (line 279) to open sidebar:
   ```typescript
   <Button 
     variant="outline" 
     size="sm"
     onClick={() => {
       const dbInvoice = invoicesData?.find((inv) => inv.id === invoice.id);
       if (dbInvoice) setSelectedInvoice(dbInvoice);
     }}
   >
     <Eye className="h-3 w-3" />
   </Button>
   ```
4. Render `InvoiceDetailSidebar` at end of component (before closing `</div>`):
   ```typescript
   <InvoiceDetailSidebar
     invoice={selectedInvoice}
     onClose={() => setSelectedInvoice(null)}
   />
   ```

**Validation:**
- Eye button opens sidebar when clicked
- Sidebar displays correct invoice data
- Close button closes sidebar
- Sidebar doesn't render when no invoice selected

---

### Phase 3: Invoice-Centric Order Creation

#### Task 3.1: Modify `CreateOrderDrawer` to Accept Optional `invoiceId` Prop

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
1. Update `CreateOrderDrawerProps` interface:
   ```typescript
   interface CreateOrderDrawerProps {
     open: boolean;
     onOpenChange: (open: boolean) => void;
     invoiceId?: string | null; // NEW: Optional invoice ID for pre-filling
   }
   ```

2. Accept `invoiceId` prop in component:
   ```typescript
   export const CreateOrderDrawer: React.FC<CreateOrderDrawerProps> = ({
     open,
     onOpenChange,
     invoiceId, // NEW
   }) => {
   ```

3. Include `invoice_id` in form submission when `invoiceId` is provided:
   ```typescript
   const onSubmit = (data: OrderFormData) => {
     const orderData = {
       ...data,
       // ... existing field conversions ...
       invoice_id: invoiceId || null, // NEW: Pre-fill from prop
     };
     
     createOrder(orderData, {
       // ... existing callbacks ...
     });
   };
   ```

**Important Notes:**
- Do NOT add a visible form field for `invoice_id` (hidden/internal only)
- Do NOT modify form schema (schema doesn't need `invoice_id` validation)
- The `invoice_id` is passed directly to the API, not through form state
- When `invoiceId` is not provided, `invoice_id` will be `null` (backward compatible)

**Validation:**
- Component still works without `invoiceId` prop (backward compatible)
- When `invoiceId` is provided, order is created with `invoice_id` set
- Form validation still works correctly
- TypeScript compiles without errors

---

#### Task 3.2: Add "Add Order" Button to Invoice Detail Sidebar

**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Changes:**
1. Import `CreateOrderDrawer` component
2. Add state for drawer open/close:
   ```typescript
   const [createOrderDrawerOpen, setCreateOrderDrawerOpen] = useState(false);
   ```
3. Add "Add Order" button in Orders section:
   - In Orders CardHeader: Add button next to title (or below empty state)
   - In Orders list: Add button below list (or in empty state prominently)
   - Button text: "Add Order"
   - Icon: `Plus` from lucide-react
4. Button onClick handler:
   ```typescript
   onClick={() => setCreateOrderDrawerOpen(true)}
   ```
5. Render `CreateOrderDrawer` at end of component:
   ```typescript
   <CreateOrderDrawer
     open={createOrderDrawerOpen}
     onOpenChange={setCreateOrderDrawerOpen}
     invoiceId={invoice?.id ?? null}
   />
   ```

**Button Placement Options:**
- **Option A:** In empty state (prominent when no orders)
- **Option B:** Always visible in CardHeader (next to "Orders" title)
- **Recommendation:** Use Option B for consistency and easy access

**Code Pattern:**
```typescript
<CardHeader className="pb-3">
  <div className="flex justify-between items-center">
    <CardTitle className="text-base">Orders</CardTitle>
    <Button
      size="sm"
      variant="outline"
      onClick={() => setCreateOrderDrawerOpen(true)}
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Order
    </Button>
  </div>
</CardHeader>
```

**Validation:**
- Button appears in Orders section
- Button opens CreateOrderDrawer when clicked
- Drawer receives correct `invoiceId` prop
- Drawer can be closed independently of sidebar

---

#### Task 3.3: Refresh Orders List After Order Creation

**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Changes:**
- Use React Query's `useQueryClient` to invalidate orders query on successful order creation
- **OR** rely on existing `useCreateOrder` hook which already invalidates `ordersKeys.all`
- **Note:** The existing `useCreateOrder` mutation invalidates `['orders']` query key, but NOT `ordersKeys.byInvoice(invoiceId)`
- **Solution:** Add `queryClient.invalidateQueries` in `useCreateOrder` hook OR use `onSuccess` callback in drawer

**Approach:** Modify `useCreateOrder` hook to also invalidate `ordersKeys.byInvoice` queries when an order is created with `invoice_id`.

**File:** `src/modules/orders/hooks/useOrders.ts`

**Changes:**
```typescript
export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (order: OrderInsert) => createOrder(order),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      // NEW: If order has invoice_id, invalidate byInvoice query
      if (data.invoice_id) {
        queryClient.invalidateQueries({ 
          queryKey: ordersKeys.byInvoice(data.invoice_id) 
        });
      }
    },
  });
}
```

**Alternative Approach (Simpler):** In `CreateOrderDrawer`, use `onSuccess` callback to close drawer, and rely on React Query's automatic refetching when component remounts or when queries are invalidated globally.

**Recommendation:** Use the hook modification approach for more precise cache invalidation.

**Validation:**
- Orders list refreshes automatically after order creation
- New order appears in Invoice detail sidebar
- No manual refresh needed

---

### Phase 4: Backward Compatibility Verification

#### Task 4.1: Verify Existing Order Creation Still Works

**Files to Check:**
- `src/modules/orders/pages/OrdersPage.tsx` (or wherever CreateOrderDrawer is used)
- `src/modules/orders/components/CreateOrderDrawer.tsx`

**Verification Steps:**
1. Find all usages of `CreateOrderDrawer` in codebase
2. Verify none of them pass `invoiceId` prop (should be optional and unused)
3. Test order creation from Orders module:
   - Open Orders page
   - Click "Create Order" button
   - Fill form and submit
   - Verify order is created with `invoice_id = null`
4. Verify TypeScript compilation:
   - All existing `CreateOrderDrawer` usages compile without errors
   - No breaking changes to component API

**Expected Behavior:**
- Existing order creation flows work exactly as before
- Orders created without invoice context have `invoice_id = null`
- No console errors or TypeScript errors

---

#### Task 4.2: Verify Invoice Detail Doesn't Break Existing Invoice List

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Verification Steps:**
1. Verify invoice table still renders correctly
2. Verify all existing invoice actions (edit, delete) still work
3. Verify invoice filtering and search still work
4. Verify stats cards still calculate correctly
5. Verify new sidebar doesn't interfere with existing layout

**Expected Behavior:**
- Invoice list page looks and behaves exactly as before
- Only addition is functional "Eye" button that opens sidebar
- No layout shifts or UI regressions

---

## File Summary

### New Files
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

### Modified Files
- `src/modules/orders/api/orders.api.ts` (add `fetchOrdersByInvoice`)
- `src/modules/orders/hooks/useOrders.ts` (add `useOrdersByInvoice` hook and update `useCreateOrder`)
- `src/modules/invoicing/pages/InvoicingPage.tsx` (wire up sidebar)
- `src/modules/orders/components/CreateOrderDrawer.tsx` (accept optional `invoiceId` prop)

---

## Testing Checklist

### Phase 1: Data Access
- [ ] `fetchOrdersByInvoice` returns correct orders for given invoice ID
- [ ] `fetchOrdersByInvoice` returns empty array when invoice has no orders
- [ ] `fetchOrdersByInvoice` throws error for invalid invoice ID
- [ ] `useOrdersByInvoice` hook fetches data correctly
- [ ] `useOrdersByInvoice` hook is disabled when `invoiceId` is null/undefined
- [ ] Query keys don't cause cache pollution

### Phase 2: Invoice Detail
- [ ] Invoice detail sidebar opens when Eye button is clicked
- [ ] Invoice detail sidebar displays all invoice information correctly
- [ ] Invoice detail sidebar closes when X button is clicked
- [ ] Orders section shows loading state initially
- [ ] Orders section shows empty state when invoice has no orders
- [ ] Orders section displays orders correctly when they exist
- [ ] Sidebar doesn't render when no invoice is selected

### Phase 3: Order Creation
- [ ] "Add Order" button appears in Invoice detail sidebar
- [ ] "Add Order" button opens CreateOrderDrawer
- [ ] CreateOrderDrawer receives `invoiceId` prop correctly
- [ ] Order created from invoice context has `invoice_id` set correctly
- [ ] Orders list in Invoice detail refreshes after order creation
- [ ] CreateOrderDrawer works without `invoiceId` prop (backward compatible)

### Phase 4: Backward Compatibility
- [ ] Orders can still be created from Orders module without invoice context
- [ ] Orders created without invoice context have `invoice_id = null`
- [ ] Invoice list page still works as before
- [ ] All existing invoice actions (edit, delete) still work
- [ ] No TypeScript compilation errors
- [ ] No runtime errors in console

---

## Success Criteria

✅ **Data Access Layer:**
- `fetchOrdersByInvoice()` function exists and works correctly
- `useOrdersByInvoice()` hook exists and works correctly
- Query keys are properly structured to prevent cache pollution

✅ **Invoice Detail View:**
- Invoice detail sidebar component exists and displays invoice information
- Orders section in Invoice detail shows orders for the selected invoice
- Loading and empty states work correctly
- Sidebar is wired to Eye button in Invoice list

✅ **Invoice-Centric Order Creation:**
- "Add Order" button exists in Invoice detail Orders section
- CreateOrderDrawer accepts optional `invoiceId` prop
- Creating order from Invoice context automatically sets `invoice_id`
- Orders list refreshes after order creation

✅ **Backward Compatibility:**
- Existing order creation paths continue to work (Orders module)
- Orders can still be created without `invoice_id` (nullable column)
- No breaking changes to existing components or APIs
- Invoice list page continues to work as before

✅ **Code Quality:**
- No schema changes or migrations required
- No changes to Jobs, Payments, Reporting, Inbox, Messages, or Notifications modules
- TypeScript compiles without errors
- Code follows existing patterns and conventions

---

## Implementation Order

1. **Phase 1** (Data Access): Complete first to enable all other phases
2. **Phase 2** (Invoice Detail): Complete next to provide UI foundation
3. **Phase 3** (Order Creation): Complete to enable full feature
4. **Phase 4** (Verification): Complete throughout and at end to ensure quality

---

## Notes

- **Pattern Consistency:** This implementation follows the proven pattern from `OrderDetailsSidebar` and the messages relationship feature
- **UI/UX:** Sidebar pattern is consistent with Orders module for familiar user experience
- **Performance:** Using React Query ensures efficient caching and automatic refetching
- **Extensibility:** Future enhancements (order editing from invoice, navigation to order detail) can be added easily
- **Error Handling:** All data fetching uses standard error handling patterns from existing codebase

