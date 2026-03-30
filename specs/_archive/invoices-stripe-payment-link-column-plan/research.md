# Research: Stripe Payment Link Column

## Link Source

- **Not stored** — `createCheckoutSession(invoiceId)` creates Stripe Checkout Session and returns URL
- **Reuse:** Same API as InvoiceDetailSidebar "Copy payment link" button
- **API:** `stripe.api.ts` → `createCheckoutSession(invoiceId)` → `{ url }`

## Column Architecture

- **invoiceColumnDefinitions.tsx** — Defines column id, label, renderHeader, renderCell
- **defaultColumns.ts** — Column metadata for visibility/width; used by Columns dialog
- **Mismatch:** defaultColumns has `actions` but invoiceColumnDefinitions does not (Actions are fixed in InvoicingPage)
- **New column:** Must be added to BOTH; id must match

## Stateful Cell

- `renderCell` returns React node; can be a component with useState for loading
- Pattern: `StripePaymentLinkCell` with internal loading state, useToast for errors

## Default Visibility

- `getDefaultColumnVisibility` sets all columns to true
- Override for `stripePaymentLink` to false to avoid clutter (user preference)
