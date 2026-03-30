# Quickstart: Stripe Payment Link Column

## Before You Start

- **Branch:** `feature/invoices-stripe-payment-link-column`
- **Spec:** `specs/invoices-stripe-payment-link-column-spec.md`

## What Changes

1. **invoiceColumnDefinitions.tsx** — New column with `StripePaymentLinkCell` that calls `createCheckoutSession(invoice.id)` on click and opens URL in new tab
2. **defaultColumns.ts** — Add `stripePaymentLink` to invoicesColumns; default visibility OFF

## Link Source

- **Same as sidebar:** `createCheckoutSession(invoiceId)` from `stripe.api.ts`
- URL is not stored; generated on demand when user clicks "Open"

## Paid Check

- `invoice.status === 'paid'` OR `invoice.stripeStatus === 'paid'` → show disabled/—
- Otherwise → show clickable "Open"

## Verification

1. Go to Invoicing page
2. Open Columns dialog → enable "Stripe payment link"
3. Unpaid invoice → click Open → new tab with Stripe Checkout
4. Paid invoice → no active link
