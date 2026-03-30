# Fix shared Orders data-loading issue affecting both Inbox and Orders page

## Overview

The Orders module’s shared data-loading layer is causing failures in two places: the main Orders page shows “Error loading orders: Unknown error”, and the Inbox Orders tab can load orders but clicking an order does not open the details sidebar reliably. The previous fix for `orders_with_options_total.person_id` resolved the DB error; the remaining issues point to the shared API, hooks, normalization, or error handling rather than Inbox-only UI.

**Context:**
- **Shared layer:** `src/modules/orders/api/orders.api.ts`, `src/modules/orders/hooks/useOrders.ts`, `normalizeOrder` and related parsing utilities.
- **Consumers:** Main Orders page (list), Inbox PersonOrdersPanel (list + order detail sidebar), plus map, reporting, and Stripe-related flows that use `orders_with_options_total` or `orders`.
- **Symptom:** Generic “Unknown error” suggests the real error (e.g. from Supabase or `normalizeOrder`) is not being surfaced to the UI.

**Goal:**
- **Primary:** Identify and fix the root cause in the shared Orders data-loading layer so that both the Orders page and the Inbox Orders tab work correctly.
- **Secondary:** Ensure real errors are shown instead of “Unknown error”; ensure clicking an order in Inbox opens the details sidebar when data is available.

---

## Current State Analysis

### Orders API layer

**File:** `src/modules/orders/api/orders.api.ts`

**Current structure:**
- `fetchOrders()` – queries `orders_with_options_total` with `select('*, customers(id, first_name, last_name)')`, returns `(data || []).map(normalizeOrder)`; throws on Supabase `error`.
- `fetchOrder(id)` – queries `orders` with `select('*, customers(...), order_additional_options(*)')`, normalizes and returns single order; throws on error or missing data.
- `fetchOrdersByPersonId(personId)` – queries `orders_with_options_total` with `select('*')` (relation removed in a prior fix), returns `(data || []).map(normalizeOrder)`; throws on Supabase `error`.
- Other functions use `orders`, `order_additional_options`, `order_people`, etc.

**Observations:**
- `fetchOrders()` still uses the `customers` relation on the **view**; if that relation is invalid for the view (as it was for `fetchOrdersByPersonId`), it can cause Supabase errors that surface as generic failures.
- Any thrown error (Supabase or from `normalizeOrder`) propagates to React Query and may be displayed as “Unknown error” if the UI does not read `error.message` or the error object shape is unexpected.
- Normalization runs on every row; if one row has an unexpected shape, `normalizeOrder` can throw and fail the whole request.

### Orders hooks layer

**File:** `src/modules/orders/hooks/useOrders.ts`

**Current structure:**
- `useOrdersList()` – calls `fetchOrders()`; used by the main Orders page.
- `useOrder(id)` – calls `fetchOrder(id)`; used by PersonOrdersPanel for the selected order detail.
- `useOrdersByPersonId(personId)` – calls `fetchOrdersByPersonId(personId)`; used by Inbox Orders tab.

**Observations:**
- If `fetchOrders()` fails (e.g. due to relation select on view), the Orders page shows the query error.
- If the error object from Supabase or a thrown exception is not an `Error` instance with `.message`, UI code that does `error instanceof Error ? error.message : 'Unknown error'` will show “Unknown error”.
- No defensive handling or error normalization in the hooks themselves.

### Normalization and parsing

**Relevant files:** `src/modules/orders/utils/numberParsing.ts` (e.g. `normalizeOrder`), `Order` type in `orders.types.ts`.

**Current structure:**
- `normalizeOrder` expects a raw order-like object, normalizes numeric and optional fields (value, permit_cost, additional_options_total, latitude, longitude, progress, order_number, geocode fields, etc.), returns an `Order`.
- Used by `fetchOrders`, `fetchOrder`, `fetchOrdersByPersonId`, `fetchOrdersByInvoice`, and after mutations.

**Observations:**
- If the Supabase response shape for a view or a relation differs (e.g. nested `customers` or missing columns), `normalizeOrder` can throw or produce inconsistent data.
- A single bad row in a list response causes the entire list fetch to fail.

### Relationship between consumers and shared layer

**Orders page:** Uses `useOrdersList()` → `fetchOrders()` → `orders_with_options_total` with `customers` relation. Failure here yields “Error loading orders” with the query error message (or “Unknown error” if message is not read correctly).

**Inbox Orders tab:** Uses `useOrdersByPersonId` → `fetchOrdersByPersonId` (view, `select('*')` only) for the list; uses `useOrder(selectedOrderId)` → `fetchOrder(id)` for the detail. If the list loads but detail fails (e.g. `fetchOrder` errors or returns nothing), the sidebar will not open. If the list fails, orders do not appear.

**Gap:** A single root cause (e.g. `fetchOrders()` failing due to relation on view, or a shared normalization/error-handling issue) can explain both the Orders page error and unreliable Inbox detail behavior. Generic “Unknown error” indicates that the real error is not being passed through or formatted for display.

### Data access patterns

**Queries against `orders_with_options_total`:**
- List: `fetchOrders()`, `fetchOrdersByPersonId()` (and elsewhere: map, reporting, Stripe). Relation `customers(...)` is used in `fetchOrders()` and in `fetchOrdersByInvoice()`.
- If the view does not support the relation in PostgREST’s eyes, these calls can fail.

**Queries against `orders`:**
- Single order: `fetchOrder(id)` with `customers` and `order_additional_options`. Table-based relation is expected to work.
- Other: `fetchOrderPersonId`, `fetchInvoicePersonIds`, mutations.

**Error handling:**
- API functions throw on Supabase `error` or missing data. Hooks do not catch or reshape errors. UI components that display errors may assume `Error` instances and show “Unknown error” for other shapes (e.g. Supabase error object).

---

## Recommended Schema Adjustments

### Database changes

- **Migrations:** None required for this fix unless investigation shows a view/relation definition issue. The view already exposes `person_id`; the remaining problems are in the client data layer and error surfacing.

### Query / data-access alignment

- **fetchOrders():** If the `customers` relation on `orders_with_options_total` is not supported or is failing, remove it for the list (same approach as `fetchOrdersByPersonId`) or resolve the view/relation so the select is valid. Prefer the smallest change that restores list loading.
- **fetchOrder(id):** Keep querying `orders` with relations; ensure errors (e.g. network, PGRST) are propagated with a clear message so the UI does not show “Unknown error”.
- **Error surfacing:** In the API or hooks, ensure that whatever is thrown or returned to React Query has a `.message` string (e.g. normalize Supabase errors to `Error` or pass `error?.message ?? error?.error_description ?? 'Unknown error'` only as fallback after logging the real value).

---

## Implementation Approach

### Phase 1: Identify root cause

- Reproduce “Error loading orders: Unknown error” on the Orders page and capture the actual error (e.g. in `fetchOrders`, log Supabase `error` and any exception from `normalizeOrder`). Check whether it is the same relation/select issue as previously seen on the view.
- Confirm whether `fetchOrders()` uses `select('*, customers(...)')` on `orders_with_options_total` and if that is invalid for this view.
- In the Orders page (and any error toast/display), find where “Unknown error” is shown and ensure the real error message is used (or that a fallback only happens after logging the actual error object).
- Optionally add minimal instrumentation (logs) along the chain (fetchOrders → useOrdersList → Orders page) and for Inbox (fetchOrder → useOrder → PersonOrdersPanel) to confirm which call fails and with what.

### Phase 2: Apply minimal fix in shared layer

- If `fetchOrders()` fails due to the `customers` relation on the view: change to `select('*')` for the list (or the minimal set of columns needed by the Orders page) so that the Orders page loads without needing the relation on the view. Restore customer display on the Orders page via a different mechanism only if required (e.g. separate lookup or a supported relation).
- If `normalizeOrder` throws on certain rows: make normalization defensive (e.g. try/catch per row, skip or default bad rows and log) so one bad row does not break the whole list; prefer fixing the data shape if it is a consistent schema issue.
- Ensure errors thrown from the API (Supabase or normalization) are `Error` instances or have a `.message` property so that `error instanceof Error ? error.message : '...'` shows the real message. If needed, in the hook or API, map Supabase errors to `new Error(supabaseError.message ?? supabaseError.error_description ?? 'Request failed')` before throwing.

### Phase 3: Verify both consumers

- Orders page: Load the list; confirm no “Unknown error”; if an error is expected (e.g. network), show the real message.
- Inbox: Load Orders tab for a person; click an order; confirm the details sidebar opens when `fetchOrder` succeeds. If `fetchOrder` was failing, the Phase 2 fixes (and any relation/error handling there) should address it.

### Safety considerations

- Avoid changing the view or other consumers (map, reporting, Stripe) unless they use the same failing path. Prefer the smallest change in `orders.api.ts` and error handling.
- Keep `fetchOrdersByPersonId` and Orders page list behavior consistent (both should get normalized orders; if we drop the relation from `fetchOrders()`, ensure the Orders page still has the data it needs or adjust only the minimal UI that depended on it).

---

## What NOT to Do

- Do not assume the viewport/breakpoint is the cause of Inbox sidebar behavior unless proven; focus on the shared data layer first.
- Do not add large refactors or new features; restrict changes to restoring loading and error surfacing.
- Do not remove or change the working `fetchOrdersByPersonId` behavior (e.g. `select('*')`) unless it is part of a single, justified fix for the same root cause.

---

## Open Questions / Considerations

- Does the main Orders page UI need the `customers` relation for the list (e.g. display customer name), or can it use only view columns and `person_id`/`person_name`?
- Are there other call sites of `fetchOrders()` or the same view + relation that would be affected by removing the relation?
- Should all Supabase errors from the orders module be normalized to `Error` in one place (e.g. a small helper in `orders.api.ts`) so every consumer sees a consistent message?
