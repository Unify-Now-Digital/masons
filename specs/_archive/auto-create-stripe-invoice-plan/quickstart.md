# Quickstart & QA: Auto-create Stripe invoice

**Feature:** [auto-create-stripe-invoice.md](../auto-create-stripe-invoice.md)  
**Plan:** [auto-create-stripe-invoice-implementation-plan.md](../auto-create-stripe-invoice-implementation-plan.md)

---

## Rollout

- No schema migrations. Deploy frontend (and ensure Edge Function `stripe-create-invoice` is deployed and env is set).
- Existing invoices without a Stripe invoice continue to show "Link"; user can click to create manually. No bulk backfill in this task.
- If auto-create fails (network, Stripe error), toast is shown and "Link" remains available for retry.

---

## QA checklist (manual)

1. **Create invoice with orders**
   - Create a new invoice with at least one order and amount > 0.
   - **Expected:** After save, table row shows Full + Partial without clicking Link. Sidebar shows Stripe data if that invoice is selected.

2. **Add first order to existing invoice**
   - Open an invoice that has no orders (or 0 amount), then add an order so amount becomes > 0.
   - **Expected:** After order is saved and amount recalculated, Stripe invoice is created and table shows Full + Partial without clicking Link.

3. **No duplicate Stripe invoices**
   - Add another order to an invoice that already has a Stripe invoice, or edit an order so amount changes.
   - **Expected:** No second Stripe invoice; table still shows one Full + Partial. Backend is idempotent; app should not trigger duplicate creation (in-flight guard / skip when `stripe_invoice_id` set).

4. **Revised invoice**
   - Revise an existing invoice (new invoice record created with orders).
   - **Expected:** New invoice gets its own Stripe invoice automatically; old invoice unchanged.

5. **Stripe create fails**
   - Simulate failure (e.g. invalid env or network off) and create an invoice with orders.
   - **Expected:** Invoice and orders are saved; user sees non-blocking toast; "Link" remains so user can retry manually.

6. **Existing invoices without Stripe**
   - Open an existing invoice that has no Stripe invoice (e.g. created before this feature).
   - **Expected:** Table shows "Link"; user can click to create Stripe invoice manually. No auto-backfill in this task.

---

## Environment

- `stripe-create-invoice` Edge Function: requires Supabase env and Stripe product IDs (e.g. `STRIPE_PRODUCT_ID_PERMIT`, `STRIPE_PRODUCT_ID_MEMORIAL`, `STRIPE_PRODUCT_ID_OPTION`). No new env for this feature.
