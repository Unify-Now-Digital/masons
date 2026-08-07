# Contracts

None. This feature is client-only: it reads the existing orders list fetch (already embedding
`job:jobs!job_id(stage, paid_at, exit_reason)` — `src/modules/orders/api/orders.api.ts:30`) and
changes only how the Orders page groups, filters, and renders those rows.

- No new or changed Supabase queries, RPCs, views, or edge functions.
- No schema migrations.
- The internal "contract" that matters is the exported vocabulary of
  `src/modules/orders/utils/orderGrouping.ts` (`OrderGroup`, `OrdersTab`, `getOrderGroup`,
  `ENQUIRY_STAGES`, `CUSTOMER_STAGES`, `ORDERS_BEFORE_PAYMENT_TABS`,
  `ORDERS_AFTER_PAYMENT_TABS`) — documented in ../data-model.md.
