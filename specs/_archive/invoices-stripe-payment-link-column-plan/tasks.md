# Tasks: Add Stripe Payment Link Column to Invoices Table

## Task Summary

| # | Task | Type | File | Phase |
|---|------|------|------|-------|
| 1.1 | Add StripePaymentLinkCell component | Create | invoiceColumnDefinitions.tsx | 1 |
| 1.2 | Add stripe_payment_link column definition | Update | invoiceColumnDefinitions.tsx | 1 |
| 2.1 | Add column to defaultColumns | Update | defaultColumns.ts | 2 |
| 2.2 | Default visibility OFF for new column | Update | defaultColumns.ts | 2 |
| 3.1 | QA checklist | Verify | - | 3 |

---

## Phase 1: Column Definition

### Task 1.1: Create StripePaymentLinkCell Component

**File:** `src/modules/invoicing/components/invoiceColumnDefinitions.tsx`

**Changes:**
- Create a stateful cell component `StripePaymentLinkCell` that:
  - Accepts `invoice: UIInvoice`
  - `isPaid = invoice.status === 'paid' || invoice.stripeStatus === 'paid'`
  - If paid: render `—` or disabled Button "Open"
  - If unpaid: render Button "Open" with onClick handler
  - onClick:
    1. Set loading state
    2. `const { url } = await createCheckoutSession(invoice.id)`
    3. `window.open(url, '_blank', 'noopener,noreferrer')`
    4. Toast on error (use useToast)
    5. Clear loading in finally
- Import `createCheckoutSession` from `../api/stripe.api`
- Import `useToast` from `@/shared/hooks/use-toast`
- Use `ExternalLink` or `Loader2` from lucide-react for icon (optional)

**Acceptance Criteria:** Cell component renders correctly; unpaid shows clickable Open; paid shows disabled/—; loading state works; errors show toast.

---

### Task 1.2: Add Column to invoiceColumnDefinitions

**File:** `src/modules/invoicing/components/invoiceColumnDefinitions.tsx`

**Changes:**
- Add new column object to the array (insert after `status`, before `dueDate`):
  ```ts
  {
    id: 'stripePaymentLink',
    label: 'Stripe payment link',
    defaultWidth: 140,
    sortable: false,
    renderHeader: () => <div>Stripe payment link</div>,
    renderCell: (invoice) => (
      <TableCell>
        <StripePaymentLinkCell invoice={invoice} />
      </TableCell>
    ),
  },
  ```
- Ensure id matches what will be added to defaultColumns

**Acceptance Criteria:** Column appears in table when visible; header and cell render.

---

## Phase 2: Default Columns Config

### Task 2.1: Add Column Metadata to defaultColumns

**File:** `src/shared/tableViewPresets/config/defaultColumns.ts`

**Changes:**
- Add to `invoicesColumns` array (after status, before dueDate to match order):
  ```ts
  { id: 'stripePaymentLink', label: 'Stripe payment link', defaultWidth: 140 },
  ```
- Order must match invoiceColumnDefinitions so column state works correctly

**Acceptance Criteria:** Column appears in Columns dialog; can be toggled on/off.

---

### Task 2.2: Default Visibility OFF

**File:** `src/shared/tableViewPresets/config/defaultColumns.ts`

**Changes:**
- Modify `getDefaultColumnVisibility` to set `stripePaymentLink` to `false` for invoices:
  ```ts
  columns.forEach(col => {
    visibility[col.id] = col.id === 'stripePaymentLink' ? false : true;
  });
  ```
- Or use a conditional: new columns default hidden to avoid clutter

**Acceptance Criteria:** New column is hidden by default; user can enable via Columns button.

---

## Phase 3: QA

### Task 3.1: Manual QA Checklist

- [ ] Enable "Stripe payment link" column via Columns button
- [ ] Unpaid invoice: click "Open" → Stripe session created, new tab opens
- [ ] Paid invoice: cell shows "—" or disabled (no action)
- [ ] Loading state shows "Opening…" or spinner while API runs
- [ ] Error (e.g. network): toast shown, no tab opened
- [ ] Column can be hidden again via Columns button
- [ ] No regression: existing columns, filters, sidebar, Actions work
- [ ] Build passes

---

## Commit Plan

Single commit: **"Add Stripe payment link column to invoices table"**

Includes: invoiceColumnDefinitions.tsx, defaultColumns.ts

---

## Progress Tracking

**Phase 1**
- [X] Task 1.1: StripePaymentLinkCell component
- [X] Task 1.2: Column definition

**Phase 2**
- [X] Task 2.1: defaultColumns metadata
- [X] Task 2.2: Default visibility OFF

**Phase 3**
- [ ] Task 3.1: QA
