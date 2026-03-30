# Research: Shared Orders data-loading root cause

## 1. Exact query used by Orders page list

- **Consumer:** `OrdersPage.tsx` uses `useOrdersList()` from `src/modules/orders/hooks/useOrders.ts`.
- **Hook:** `useOrdersList()` calls `fetchOrders()` from `src/modules/orders/api/orders.api.ts`.
- **Query (current):**
  ```ts
  supabase
    .from('orders_with_options_total')
    .select('*, customers(id, first_name, last_name)')
    .order('created_at', { ascending: false })
  ```
- **Conclusion:** The Orders page list uses the **same view** as the Inbox Orders tab (`orders_with_options_total`) but **with** the `customers` relation. The Inbox was fixed by removing that relation and using `select('*')` only.

## 2. Whether `select('*, customers(...)')` on the view causes failure

- **Evidence:** In `orders.api.ts`, `fetchOrdersByPersonId` already has a comment: *"selecting the customers relation from a VIEW caused Supabase to return an error for this query path"* and was changed to `select('*')`.
- **Same pattern:** `fetchOrders()` still uses `select('*, customers(id, first_name, last_name)')` on `orders_with_options_total`. PostgREST/Supabase typically require FK metadata on the **queried** resource; a view may not expose the same relation as the underlying `orders` table, so the relation select on the view can fail.
- **Conclusion:** Yes. Using the `customers` relation on `orders_with_options_total` is the same failing pattern and is the **root cause** of the Orders page list failure.

## 3. Whether `normalizeOrder` can still throw and fail the whole list

- **Current code:** `fetchOrders()` and `fetchOrdersByPersonId()` both do `(data || []).map(normalizeOrder)` with no per-row try/catch. If `normalizeOrder` throws on one row (e.g. unexpected type), the entire promise rejects and React Query sees an error.
- **Conclusion:** Yes. A single bad row can cause the whole list to fail. For this fix we focus on removing the relation so the request succeeds; defensive normalization can be a follow-up if needed.

## 4. Where "Unknown error" is produced

- **Orders page:** `src/modules/orders/pages/OrdersPage.tsx` line 152:
  ```tsx
  Error loading orders: {error instanceof Error ? error.message : 'Unknown error'}
  ```
- **Mechanism:** When `fetchOrders()` throws, it does `if (error) throw error`, so the thrown value is the **Supabase client error object**. That object is often a plain object `{ message, details, code }`, not an `Error` instance. So `error instanceof Error` is `false` and the UI shows the fallback `'Unknown error'`.
- **Conclusion:** "Unknown error" appears because the Orders page only displays `error.message` when `error instanceof Error`. Supabase errors are not `Error` instances, so the real message is dropped.

## 5. Whether `useOrder` / `fetchOrder` is affected (Inbox detail issue)

- **Detail flow:** Inbox uses `useOrder(selectedOrderId)` → `fetchOrder(id)`.
- **fetchOrder:** Queries the **table** `orders` (not the view) with `select('*, customers(...), order_additional_options(*)')`. Tables have proper FK relations, so this is expected to work.
- **Conclusion:** `fetchOrder` is not using the view; it queries `orders` and is not the same failure as the list. If Inbox order details still fail to open, the cause is likely elsewhere (e.g. `selectedOrderId` not updating, or layout/CSS hiding the sidebar). The shared list fix (fetchOrders) restores the Orders page; Inbox list was already fixed by `fetchOrdersByPersonId` using `select('*')`.

## Shared root cause (single fix for Orders page)

- **Root cause:** `fetchOrders()` uses `select('*, customers(id, first_name, last_name)')` on the **view** `orders_with_options_total`. That relation is not valid for the view in PostgREST, so the request fails. The thrown Supabase error is not an `Error` instance, so the Orders page shows "Unknown error".
- **Minimal fix:** Change `fetchOrders()` to use `select('*')` on `orders_with_options_total` (same as `fetchOrdersByPersonId`). The view already includes `o.*` from `orders`, so `person_name` and `customer_name` are present; `orderTransform.ts` uses `person_name` first for the "customer" display, so the list does not require the `customers` relation.
- **Optional:** Normalize thrown errors in the API to `new Error(error?.message ?? 'Request failed')` so all consumers see a real message instead of "Unknown error" when something else fails later.
