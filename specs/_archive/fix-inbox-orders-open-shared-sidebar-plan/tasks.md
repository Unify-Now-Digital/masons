# Tasks: Inbox open same order details sidebar as Orders page

## Phase 1: Add page-level sidebar state and render in UnifiedInboxPage

- [ ] **Task 1.1** – In `UnifiedInboxPage.tsx`, add state: `const [selectedOrderIdForSidebar, setSelectedOrderIdForSidebar] = useState<string | null>(null)`.
- [ ] **Task 1.2** – In `UnifiedInboxPage.tsx`, add `useOrder(selectedOrderIdForSidebar ?? '')` to get the order for the sidebar (or use a single `useOrder` and pass the id; ensure `enabled` is true only when `selectedOrderIdForSidebar` is non-empty).
- [ ] **Task 1.3** – In `UnifiedInboxPage.tsx`, at **page root** (e.g. just before the closing `</div>` of the main page wrapper, same level as other full-page UI), render:
  - Backdrop: `{selectedOrderIdForSidebar && <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setSelectedOrderIdForSidebar(null)} aria-hidden />}`.
  - Sidebar: `<OrderDetailsSidebar order={selectedOrderData} onClose={() => setSelectedOrderIdForSidebar(null)} onOrderUpdate={handleOrderUpdateForInbox} />` where `selectedOrderData` is the result of `useOrder`, and `handleOrderUpdateForInbox` invalidates orders-by-person for the active person if needed.
- [ ] **Task 1.4** – Clear sidebar when person changes: in the existing `useEffect` that runs when `activePersonId` changes and sets `setSelectedOrderId(null)`, also call `setSelectedOrderIdForSidebar(null)` (or merge into one state if we collapse selectedOrderId into this; see below).
- [ ] **Task 1.5** – Pass to `PersonOrdersPanel`: `onOpenOrderDetails={(id) => setSelectedOrderIdForSidebar(id)}`. Optionally keep `selectedOrderId` and `onSelectOrder` for list highlight only, or use `selectedOrderIdForSidebar` for both highlight and sidebar so one state rules both.

## Phase 2: PersonOrdersPanel — open popout instead of embedded sidebar

- [ ] **Task 2.1** – Add prop to `PersonOrdersPanel`: `onOpenOrderDetails?: (orderId: string) => void`.
- [ ] **Task 2.2** – On order row click: call `onOpenOrderDetails?.(order.id)` in addition to (or instead of, if we use one state) `onSelectOrder(order.id)`.
- [ ] **Task 2.3** – Remove the embedded sidebar block: delete the conditional block that renders `OrderDetailsSidebar` inside the card (the `{selectedOrderId && selectedOrder && ( ... <OrderDetailsSidebar /> ... )}` block).
- [ ] **Task 2.4** – Optional: remove `useOrder` and `selectedOrder` from PersonOrdersPanel if no longer needed; keep `selectedOrderId` only if we still use it for row highlight (and pass it from parent). If parent only passes `onOpenOrderDetails`, we can remove `selectedOrderId` / `onSelectOrder` / `onCloseOrder` from the panel and only keep highlight state local or derive from a single parent state.
- [ ] **Task 2.5** – Optional (product): when auto-selecting the first order on load, call `onOpenOrderDetails?.(orders[0].id)` so the sidebar opens for the first order.

## Phase 3: Verify and clean up

- [ ] **Task 3.1** – Confirm Orders page unchanged: "View" still opens the same sidebar behavior.
- [ ] **Task 3.2** – In Inbox, select a person with orders, click an order row; confirm the right-side popout opens (same as Orders page "View") and closes via backdrop or close button.
- [ ] **Task 3.3** – Confirm only one sidebar is visible at a time (no duplicate embedded + popout).

---

## Exact files to change

| File | Changes |
|------|--------|
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Add `selectedOrderIdForSidebar` state; add `useOrder(selectedOrderIdForSidebar)`; render backdrop + `OrderDetailsSidebar` at page root; pass `onOpenOrderDetails` to PersonOrdersPanel; clear sidebar when `activePersonId` changes; implement `onOrderUpdate` for sidebar (invalidate by-person queries). |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` | Add optional prop `onOpenOrderDetails?: (orderId: string) => void`; on row click call `onOpenOrderDetails?.(order.id)`; remove the embedded `OrderDetailsSidebar` block; optionally remove `useOrder` / `selectedOrderId` / `onCloseOrder` if unused, or keep `selectedOrderId` for row highlight only. |

No changes to `OrdersPage.tsx`, `OrderDetailsSidebar.tsx`, or orders API/hooks.
