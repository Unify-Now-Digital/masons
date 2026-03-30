# Tasks: Fix shared Orders data-loading

## Phase 1: Fix Orders page list (root cause)

- [x] **Task 1.1** – In `src/modules/orders/api/orders.api.ts`, change `fetchOrders()` to use `select('*')` instead of `select('*, customers(id, first_name, last_name)')` on `orders_with_options_total`. Add a short comment that the relation on the view is not supported (same as `fetchOrdersByPersonId`).
- [x] **Task 1.2** – (Optional) Add a small helper in `orders.api.ts` to normalize Supabase errors to `Error` before throwing (e.g. `error.message ?? error.error_description ?? 'Request failed'`) so the Orders page and other consumers never see "Unknown error" when the API throws. Implemented inline in `fetchOrders()`: `throw new Error(error.message ?? 'Failed to fetch orders')`.

## Phase 2: Verify consumers

- [ ] **Task 2.1** – Load the main Orders page; confirm the list loads and no "Error loading orders: Unknown error" appears.
- [ ] **Task 2.2** – In Inbox, select a person with orders; confirm the Orders tab list still loads. Click an order and confirm the details sidebar opens (if it still does not, the cause is outside the shared list API—e.g. state or layout).

## Exact files to change

| File | Change |
|------|--------|
| `src/modules/orders/api/orders.api.ts` | In `fetchOrders()`, replace `.select('*, customers(id, first_name, last_name)')` with `.select('*')` and add a one-line comment. Optionally add error normalization when throwing. |

No changes to hooks, Orders page UI, or Inbox components for this minimal fix. Preserve `fetchOrdersByPersonId` and `fetchOrder` as-is.
