# Feature: Add "Stripe payment link" Column to Invoices Table

## Overview

**Goal:** Add a new column "Stripe payment link" to the main Invoices table in the Invoicing module. The column shows a clickable "Open" action for unpaid invoices; paid invoices show a disabled or empty state. The link reuses the same source/logic as the invoice details sidebar.

---

## Discovery Summary

### 1. Invoice Details Sidebar (Eye Icon)

| Item | Finding |
|------|---------|
| **Component** | `InvoiceDetailSidebar` (`src/modules/invoicing/components/InvoiceDetailSidebar.tsx`) |
| **Opened by** | Eye icon button in InvoicingPage table row |
| **Link source** | **Computed on demand** — NOT stored on invoice |
| **API** | `createCheckoutSession(invoiceId)` → `stripe.api.ts` |
| **Flow** | Calls Edge Function `stripe-create-checkout-session`; returns `{ url }` |
| **Button** | "Copy payment link" — only shown when `!isPaid` |
| **Paid check** | `isPaid = invoice.status === 'paid' \|\| invoice.stripe_status === 'paid'` |

### 2. Invoice Table Columns

| Item | Finding |
|------|---------|
| **Column definitions** | `src/modules/invoicing/components/invoiceColumnDefinitions.tsx` |
| **Structure** | `InvoiceColumnDefinition[]` with `id`, `label`, `renderHeader`, `renderCell` |
| **Visibility/presets** | `src/shared/tableViewPresets/config/defaultColumns.ts` — `invoicesColumns` |
| **Rendering** | InvoicingPage uses `invoiceColumnDefinitions`; visible columns filtered by `columnState.visibility` |
| **Data** | `renderCell(invoice: UIInvoice, ...)` — invoice has `id`, `status`, `stripeStatus` |

### 3. Invoice List Query

| Item | Finding |
|------|---------|
| **API** | `fetchInvoices()` — `select('*')` from `invoices` |
| **Fields** | Includes `stripe_status` (invoice list has all fields) |
| **UIInvoice** | `transformInvoiceForUI` maps `stripe_status` → `stripeStatus` |

### 4. Link Logic (Reuse)

- **Sidebar**: `createCheckoutSession(invoice.id)` → get `url` → copy to clipboard
- **Table column**: Same API — call `createCheckoutSession(invoice.id)` on click → get `url` → `window.open(url, '_blank')`
- **No stored URL** — must call API when user clicks

---

## Functional Requirements

1. **New column** "Stripe payment link" in Invoices table
2. **Unpaid invoices** (`status !== 'paid'` and `stripeStatus !== 'paid'`):
   - Show clickable "Open" button/link
   - On click: call `createCheckoutSession(invoice.id)` → open URL in new tab
   - Loading state while API is in progress ("Opening…")
   - Toast on error
3. **Paid invoices**: Show "—" or disabled "Open"
4. **URL source**: Reuse `createCheckoutSession` from `stripe.api.ts` (same as sidebar)
5. **No backend changes** — invoice list already has `stripe_status`; API takes `invoice_id`

---

## UX / Security

- Do NOT render full URL in table
- Open in new tab (`target="_blank"`) — use safe pattern (e.g. `window.open` or `<a target="_blank" rel="noopener noreferrer">`)
- If API fails, show toast; do not open

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `src/modules/invoicing/components/invoiceColumnDefinitions.tsx` | Add new column definition with `StripePaymentLinkCell` component |
| `src/shared/tableViewPresets/config/defaultColumns.ts` | Add `{ id: 'stripePaymentLink', label: 'Stripe payment link', defaultWidth: 140 }` to `invoicesColumns` |

### Column Cell Component

- Create `StripePaymentLinkCell` (or inline in renderCell) that:
  - Receives `invoice: UIInvoice`
  - `isPaid = invoice.status === 'paid' || invoice.stripeStatus === 'paid'`
  - If paid: return `—` or disabled state
  - If unpaid: render Button "Open" with `onClick`:
    1. Set loading true
    2. `const { url } = await createCheckoutSession(invoice.id)`
    3. `window.open(url, '_blank', 'noopener,noreferrer')`
    4. Toast on success (optional) or on error
    5. Set loading false
- Use `useState` for loading — component must be stateful (renderCell can return a component)

### Column Order

- Insert after "Status" or before "Due Date" (or at end before Actions) — match existing layout preferences

---

## Acceptance Criteria

- [ ] Invoices table shows "Stripe payment link" column
- [ ] Unpaid invoices display "Open" action that opens the same link as sidebar (createCheckoutSession)
- [ ] Paid invoices do not show active payment link (— or disabled)
- [ ] No regressions to invoice totals, filters, sorting, column controls
- [ ] Column visibility can be toggled via Columns dialog
- [ ] Link opens in new tab with safe attributes

---

## Non-Goals

- No backend/Edge Function changes
- No changes to InvoiceDetailSidebar (reuse existing API only)
- No storage of checkout URL on invoice record

---

## Files Reference

| Path | Purpose |
|------|---------|
| `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` | Sidebar with Copy payment link; uses createCheckoutSession |
| `src/modules/invoicing/components/invoiceColumnDefinitions.tsx` | Column definitions; add new column |
| `src/modules/invoicing/api/stripe.api.ts` | createCheckoutSession(invoiceId) |
| `src/shared/tableViewPresets/config/defaultColumns.ts` | invoicesColumns for visibility/presets |
| `src/modules/invoicing/pages/InvoicingPage.tsx` | Table rendering; uses invoiceColumnDefinitions |
| `src/modules/invoicing/utils/invoiceTransform.ts` | UIInvoice type has stripeStatus |
