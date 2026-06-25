# Feature Specification: Deposit at Invoice Creation

**Status:** Draft (specify)
**Branch (suggested):** `016-deposit-at-creation`
**Depends on:** Partial-payment sidebar flow (commits 03163b3, 32ea660, ae9702f + Collect-card reorder)

## Summary

When creating an invoice, the user chooses **Full payment** or **Partial payment**. For
partial, they enter an amount or a percentage. This intent is persisted on the invoice.
Later, when the invoice's checkout sidebar is opened, the Collect-payment card pre-fills
from that stored intent instead of the generic suggested deposit.

The creation drawer does **not** mint any Stripe link — no Stripe invoice exists at creation
time. It only records intent. Link generation continues to happen in the sidebar, unchanged.

## Why

Today, partial-payment amount/% can only be set in the sidebar *after* the Stripe invoice
is created. Staff want to capture the deposit decision at the point of invoice creation,
where the order context is fresh, and have it carry through automatically.

## User Stories

### US-1 — Choose full payment at creation
As staff creating an invoice, I can select "Full payment" so that no deposit is pre-set and
the invoice behaves exactly as invoices do today.
- The drawer defaults to Full payment.
- Choosing Full persists no deposit intent (null).
- The sidebar later shows its normal suggested deposit default in the Collect card.

### US-2 — Set a partial deposit at creation
As staff creating an invoice, I can select "Partial payment" and enter an amount (GBP) or a
percentage, so the deposit I intend to collect is remembered.
- Entering an amount or a % is mutually derived (matching the sidebar's existing behavior).
- Validated: greater than 0, not exceeding 100% / the invoice total.
- On save, the deposit is persisted as a **percent** of the invoice total.

### US-3 — Pre-filled deposit in the sidebar
As staff opening the checkout sidebar for an invoice created with a partial deposit, I see
the Collect-payment card pre-filled with that deposit.
- If stored deposit percent exists, the Collect card seeds amount/% from it (applied to the
  current amount_remaining).
- If no stored deposit, the Collect card shows the existing suggested default (unchanged).
- The user can override the pre-filled value before generating the link.

## Acceptance Criteria

1. Full payment selected stores no deposit; sidebar behavior identical to current production.
2. Partial + a % stores that percent; sidebar pre-fills the Collect card to that % of remaining.
3. Partial + a fixed amount stores the equivalent percent (derived from invoice total at
   creation); sidebar pre-fills accordingly.
4. If the invoice total changes before Stripe-invoice creation, the pre-filled amount
   re-derives from the stored percent against the new remaining balance.
5. A stored deposit never auto-generates or auto-opens any link. Generation stays explicit.
6. Validation rejects deposit values <= 0 or > 100% (or > invoice total) at creation.
7. Existing invoices (no stored deposit) are unaffected.

## Out of Scope

- Minting Stripe links from the creation drawer (impossible pre-Stripe-invoice).
- Storing a fixed-pence deposit that survives total changes (rejected — percent is the form).
- Any edge-function change.
- Full-payment-in-drawer meaning "100% pre-fill" (rejected — full = no pre-fill).

## Technical Constraints / Decisions (pre-settled, for /speckit.plan)

- **Schema:** new nullable column on invoices:
  intended_deposit_percent numeric null
  with check (intended_deposit_percent is null
  or (intended_deposit_percent > 0 and intended_deposit_percent <= 100)). null = full.
- **Migration:** applied manually via Supabase Dashboard SQL editor (never db push).
  Requires Arin sign-off before applying to production (bfwohzcugtwbhhxdqgme).
- **Types:** add intended_deposit_percent?: number | null to invoice type + row->model transform.
- **Drawer:** CreateInvoiceDrawer.tsx gains Full/Partial control + amount/% inputs. Copy makes
  clear a percent is saved even when an amount was typed.
- **Sidebar:** Collect-card prefill effect reads intended_deposit_percent first; falls back to
  the suggested default when null.
- **Units trap:** amount is decimal pounds; amount_remaining is bigint pence. Seed via
  round(amount_remaining * percent / 100). Use existing helpers, not hand-rolled math.

## Open Questions (resolve in plan/analyze)

- Which "invoice total" base does the drawer use to convert a typed amount -> percent, given
  the amount = 0 vs main_product_total inconsistency? Likely order-derived total, not invoice
  amount. Grep how the drawer computes its displayed total before implementing.
- Does CreateInvoiceDrawer already compute a running total we can reuse for the conversion?
