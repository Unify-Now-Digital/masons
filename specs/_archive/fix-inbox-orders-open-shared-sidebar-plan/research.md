# Research: Inbox order details sidebar — minimal change plan

## 1. How Orders page manages selectedOrder and sidebar open/close

**File:** `src/modules/orders/pages/OrdersPage.tsx`

- **State:** `const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)` (line ~24).
- **Open:** When user clicks "View" on a row, `SortableOrdersTable` calls `onViewOrder(order)`. The handler finds the full DB order from `ordersData` and sets it: `if (dbOrder) setSelectedOrder(dbOrder)`.
- **Close:** 
  - Backdrop: `{selectedOrder && <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setSelectedOrder(null)} />}`.
  - Sidebar close button: `OrderDetailsSidebar` receives `onClose={() => setSelectedOrder(null)}`.
- **Visibility:** Sidebar is always mounted; `OrderDetailsSidebar` receives `order={selectedOrder}` and returns `null` when `!order` (see component). So open/close is effectively "selectedOrder non-null vs null".

## 2. Which component renders the shared sidebar on Orders page

- **Component:** `OrderDetailsSidebar` from `@/modules/orders/components/OrderDetailsSidebar`.
- **Where:** Rendered once at **page root** in `OrdersPage.tsx`, after the backdrop (lines 307–312):
  ```tsx
  <OrderDetailsSidebar 
    order={selectedOrder} 
    onClose={() => setSelectedOrder(null)}
    onOrderUpdate={handleOrderUpdate}
  />
  ```
- **Styling:** The sidebar itself uses `className="fixed right-0 top-0 h-full w-96 ..."` (fixed overlay), so it behaves as a right-side popout regardless of parent. The important part is that it is rendered at **page root** with a **backdrop** so it is not clipped or hidden by a narrow column.

## 3. What minimal state/handler to lift into UnifiedInboxPage

- **State:** One of:
  - **Option A (match Orders page):** `selectedOrderForSidebar: Order | null` — then Inbox must have the full `Order` when opening (e.g. from `useOrder(orderId)` or from the list’s order object). Orders page has `ordersData` in scope so it can do `ordersData?.find(o => o.id === order.id)`; Inbox has the list from `useOrdersByPersonId` but detail from `useOrder`. So we can either pass `orderId` and let the page hold `selectedOrderIdForSidebar` and use `useOrder(selectedOrderIdForSidebar)` to get the order, or pass the order from the list (list items are already `Order` from the view).
  - **Option B (minimal):** `selectedOrderIdForSidebar: string | null`. Inbox page uses `useOrder(selectedOrderIdForSidebar)` and passes `data` to `OrderDetailsSidebar`. Same pattern as current PersonOrdersPanel but state lives in UnifiedInboxPage and the sidebar is rendered at page root with backdrop.
- **Handler:** `onOpenOrderDetails(orderId: string)` (and optionally `onCloseOrderDetails()` or reuse a single state setter). When an order row is clicked in PersonOrdersPanel, it calls `onOpenOrderDetails(order.id)` instead of (or in addition to) `onSelectOrder(order.id)`.
- **Recommendation:** Use **Option B**: in `UnifiedInboxPage` add `selectedOrderIdForSidebar: string | null` state and render a single `OrderDetailsSidebar` at page root (with backdrop), fed by `useOrder(selectedOrderIdForSidebar)`. PersonOrdersPanel calls a parent prop `onOpenOrderDetails(orderId)` to set that state. No need to pass full `Order` from panel to page; the page fetches it via existing `useOrder`.

## 4. How PersonOrdersPanel should notify the parent (e.g. onOpenOrderDetails(orderId))

- **New prop:** `onOpenOrderDetails?: (orderId: string) => void`.
- **On row click:** When user clicks an order row, call both:
  - `onSelectOrder(order.id)` — keeps current selection highlight in the list (optional; can keep for visual feedback).
  - `onOpenOrderDetails?.(order.id)` — opens the page-level sidebar. If `onOpenOrderDetails` is not provided (e.g. used elsewhere), no popout.
- **Auto-select first order:** The current effect that does `onSelectOrder(orders[0].id)` can also call `onOpenOrderDetails?.(orders[0].id)` so the first order opens the sidebar when the list loads (optional; product decision).
- **Minimal:** Only add `onOpenOrderDetails` and call it on row click; parent is responsible for setting `selectedOrderIdForSidebar` and rendering the sidebar.

## 5. Which old local sidebar logic in PersonOrdersPanel should be removed

- **Remove:**
  - The entire block that renders `OrderDetailsSidebar` inside the card (lines 116–124):
    ```tsx
    {selectedOrderId && selectedOrder && (
      <div className="mt-3 border-t pt-3 max-h-[400px] overflow-y-auto">
        <OrderDetailsSidebar ... />
      </div>
    )}
    ```
- **Remove (optional but recommended):** `useOrder(selectedOrderId ?? '')` and `selectedOrder` from PersonOrdersPanel, and the `selectedOrderId` / `onCloseOrder` props if they are only used for that embedded sidebar. If we keep `selectedOrderId` for row highlight only, we can keep it and only remove the embedded sidebar block.
- **Keep:** Orders list, loading/error/empty states, row click that calls `onSelectOrder(order.id)` and now also `onOpenOrderDetails?.(order.id)`. Keep `handleOrderUpdate` and pass it to the parent so the page-level sidebar can pass it to `OrderDetailsSidebar` (or the page can define its own handler that invalidates by-person queries).

**Summary:** Remove the embedded `OrderDetailsSidebar` and its wrapper div. Optionally remove `useOrder` and `selectedOrder` from PersonOrdersPanel if the panel no longer needs to show any inline detail; otherwise keep `selectedOrderId` for highlight and drop only the sidebar block.
