# Fix Inbox Orders tab to open shared order details sidebar

## Overview

Clicking an order on the Inbox Orders tab currently does not open the same right-side order details / checkout sidebar that is used on the main Orders page when clicking “View”. The Orders page now loads correctly and its sidebar works; the Inbox Orders tab now loads orders for the selected person; but the interaction from Inbox does not trigger or show the shared sidebar as expected.

**Context:**
- **Orders page:** Uses `OrdersPage.tsx` with a `SortableOrdersTable` and a shared `OrderDetailsSidebar` component rendered at the page root, driven by local `selectedOrder` state.
- **Inbox page:** Uses `UnifiedInboxPage.tsx` with a `PersonOrdersPanel` component in the right-hand column; `PersonOrdersPanel` embeds `OrderDetailsSidebar` directly and uses `useOrder(selectedOrderId)` plus `onSelectOrder(order.id)` from the orders list.
- **Existing spec/plan:** `inbox-person-orders-panel-embedded-order-details.md` and its implementation plan describe an embedded sidebar inside Inbox, but behavior expectations have shifted: users now want Inbox clicks to reuse the **same** page-level popout experience as the Orders page “View”.

**Goal:**
- **Primary objective:** Make clicking an order in the Inbox Orders tab open the **same shared `OrderDetailsSidebar` experience** used by the Orders page “View” button, so users see a consistent order details/checkout panel regardless of entry point.
- **Secondary objectives:**
  - Keep the fix minimal: reuse existing components and state patterns rather than duplicating UI.
  - Preserve current working behavior of the Orders page; do not break `SortableOrdersTable` or its “View” action.

---

## Current State Analysis

### Entity 1: Orders page UI and state

**File:** `src/modules/orders/pages/OrdersPage.tsx`

**Current Structure:**
- Maintains local React state:
  - `selectedOrder: Order | null` – controls whether the right-side `OrderDetailsSidebar` is open.
  - Other state for create/edit/delete drawers, columns, filters, etc.
- Renders the Orders list via `SortableOrdersTable` with an `onViewOrder` prop:
  - `onViewOrder={(order) => { const dbOrder = ordersData?.find((o) => o.id === order.id); if (dbOrder) setSelectedOrder(dbOrder); }}`
- Renders:
  - A backdrop when `selectedOrder` is non-null:
    - `<div className="fixed inset-0 z-40 bg-black/10" onClick={() => setSelectedOrder(null)} />`
  - A single shared `OrderDetailsSidebar` at the page root:
    - `<OrderDetailsSidebar order={selectedOrder} onClose={() => setSelectedOrder(null)} onOrderUpdate={handleOrderUpdate} />`

**Observations:**
- The Orders page uses **local page-level state** to drive the sidebar and a full-viewport fixed-position popout (`OrderDetailsSidebar` uses `fixed right-0 top-0 h-full w-96 ...`).
- The “View” action is coupled to this local `setSelectedOrder` state, not to any shared/global mechanism.

### Entity 2: Inbox person orders panel and state

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Current Structure:**
- Maintains state:
  - `selectedPersonId`, `selectedConversationId`, `selectedOrderId`, etc.
  - Computes `activePersonId = selectedConversation?.person_id ?? selectedPersonId ?? null`.
- Layout:
  - Three columns: People sidebar | Conversation area | Related Orders panel.
  - Related Orders panel column:
    ```tsx
    <div className="hidden lg:flex lg:flex-col min-h-0 min-w-0 overflow-hidden">
      <PersonOrdersPanel
        personId={activePersonId}
        selectedOrderId={selectedOrderId}
        onSelectOrder={setSelectedOrderId}
        onCloseOrder={() => setSelectedOrderId(null)}
      />
    </div>
    ```

**File:** `src/modules/inbox/components/PersonOrdersPanel.tsx`

**Current Structure:**
- Fetches orders for the person with `useOrdersByPersonId(personId)`.
- Autoselects the first order for a new person via `onSelectOrder(orders[0].id)`.
- Fetches the selected order via `useOrder(selectedOrderId ?? '')`.
- Embeds `OrderDetailsSidebar` **inside** the card:
  ```tsx
  {selectedOrderId && selectedOrder && (
    <div className="mt-3 border-t pt-3 max-h-[400px] overflow-y-auto">
      <OrderDetailsSidebar
        order={selectedOrder}
        onClose={onCloseOrder}
        onOrderUpdate={handleOrderUpdate}
      />
    </div>
  )}
  ```

**Observations:**
- Inbox uses an **embedded** instance of `OrderDetailsSidebar` inside `PersonOrdersPanel`, not the shared page-level popout wrapper used on `OrdersPage`.
- The click in Inbox (`onClick={() => onSelectOrder(order.id)}`) currently drives `selectedOrderId` and the embedded sidebar only; it does **not** touch the Orders page’s `selectedOrder` state (they are separate).

### Relationship Analysis

**Current Relationship between Orders and Inbox:**
- Shared components:
  - `OrderDetailsSidebar` – used both in `OrdersPage` (popout) and `PersonOrdersPanel` (embedded).
  - `Order` types, APIs, and hooks.
- Separate state:
  - `OrdersPage` uses its own `selectedOrder` to control the fixed sidebar.
  - `UnifiedInboxPage` controls `selectedOrderId` passed into `PersonOrdersPanel`, which then fetches and embeds `OrderDetailsSidebar`.

**Gaps/Issues:**
- Clicking an order in the Inbox Orders tab does **not** reuse the `OrdersPage` popout logic; it opens (or attempts to open) a **different embedded instance** of the sidebar, scoped to the Inbox card layout.
- Users perceive this as “click does nothing” if:
  - The embedded sidebar is visually constrained/hidden (e.g. panel column not visible at current viewport), or
  - The expectation is to see the full-height right-side popout like on the Orders page.

### Data Access Patterns

**Orders page:**
- Uses `useOrdersList()` and local `selectedOrder` without any knowledge of Inbox.

**Inbox Orders tab:**
- Uses `useOrdersByPersonId(personId)` for the list and `useOrder(selectedOrderId)` for detail.
- Renders `OrderDetailsSidebar` inline; it does not call any shared “open order sidebar” action.

**How they are queried together:**
- Both pages rely on the same Orders APIs and `OrderDetailsSidebar`, but their **state and placement** are independent.

---

## Recommended Schema Adjustments

### Database Changes

- **None.** This feature is purely about UI composition and state wiring; Orders data and schema are already functioning.

### Query/Data-Access Alignment

- **No changes** required to Orders APIs or hooks for this feature. We will:
  - Continue using `useOrdersByPersonId` + `useOrder` in Inbox, but route clicks into a shared sidebar opening mechanism rather than an embedded sidebar.

**Recommended Display Patterns:**
- Prefer a **single shared `OrderDetailsSidebar` instance** per page, controlled by a clear `selectedOrder` state and rendered at a consistent layout position (e.g. fixed right-side popout).
- Inbox should trigger the same sidebar behavior used by the Orders page rather than embedding a second instance inside `PersonOrdersPanel`.

---

## Implementation Approach

### Phase 1: Clarify shared sidebar contract

- Define or reuse a **shared contract** for opening the order details sidebar:
  - Either:
    - Lift `selectedOrder` state (or an equivalent `activeOrderId`) into a higher-level context (e.g. a lightweight `OrderSidebarContext`), so both Orders page and Inbox can call a common `openOrderSidebar(orderId)` function, or
    - For a minimal change, expose a prop or handler from `UnifiedInboxPage` that sets a page-level `selectedOrderForSidebar` and renders the shared `OrderDetailsSidebar` at the root of the Inbox page instead of inside `PersonOrdersPanel`.
- Keep `OrderDetailsSidebar` as the single shared UI component.

### Phase 2: Wire Inbox clicks to shared sidebar

- Update `UnifiedInboxPage` to:
  - Introduce a local `selectedOrderForSidebar: Order | null` (or `selectedOrderForSidebarId: string | null` + `useOrder`) similar to `OrdersPage`.
  - Render:
    - A backdrop and the shared `OrderDetailsSidebar` at the page root (Inbox layout) driven by this state.
- Update `PersonOrdersPanel` so that:
  - Instead of embedding its own `OrderDetailsSidebar`, it calls a parent-provided `onOpenOrderDetails(orderId)` that triggers the shared sidebar state in `UnifiedInboxPage`.
  - Remove or reduce the embedded sidebar usage to avoid duplicate panels.

### Safety Considerations

- Ensure that:
  - The Orders page behavior remains unchanged (still uses its own `selectedOrder` and page-level sidebar).
  - Inbox does not accidentally open **two** sidebars at once (embedded + global); aim for a single, consistent sidebar per page.
  - Existing tests or flows that rely on `PersonOrdersPanel` embedded behavior are reviewed; if the embedded panel is still desirable in some contexts, we can keep it as a fallback when the shared sidebar handler is not provided.

---

## What NOT to Do

- Do not duplicate `OrderDetailsSidebar` markup in a new component; always reuse the existing `OrderDetailsSidebar`.
- Do not introduce global, cross-page state for orders unless necessary; prefer page-level shared state within Inbox and within Orders page.
- Do not change data-loading logic or existing Orders APIs/hooks as part of this feature; those are already working for both pages.

---

## Open Questions / Considerations

- Should Inbox always use the full-screen fixed sidebar, or is there value in retaining an embedded variant for smaller screens (e.g. keeping `PersonOrdersPanel` inline and only using the popout on larger viewports)?
- Is there any other part of the app that would benefit from a shared `openOrderSidebar(orderId)` API (e.g. from map pins, reporting views), suggesting a small shared context or hook?
- Are there accessibility considerations (focus management, ARIA attributes) we should standardize for the shared sidebar when triggered from different entry points (Orders vs Inbox)? 

