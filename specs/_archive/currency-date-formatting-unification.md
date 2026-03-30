# Unify Currency (GBP) and Date (DD-MM-YYYY) Formatting Across App

## Overview

Standardize all **user-facing** currency and date display across the application so every page/module consistently uses:

- **Currency**: GBP
- **Currency symbol**: `£`
- **Date format**: `DD-MM-YYYY`

This is a **display-layer unification task only**.

**Do not change**:
- database schemas
- stored units/values (pounds vs pence)
- Stripe payment logic
- calculation/business rules (invoice totals, order totals, etc.)
- filtering/sorting semantics (formatting must remain separate from raw values)

**Goal:**
- Remove inconsistent `$` / `en-US` formatting and inconsistent date formats (`YYYY-MM-DD`, locale defaults, `DD/MM/YYYY`, etc.).
- Replace one-off inline formatting with shared helpers.

---

## Current State Analysis

### Currency formatting (current)

Existing patterns (non-exhaustive):
- **Invoices list** currently formats invoice amount with `$` and `en-US` locale in `src/modules/invoicing/utils/invoiceTransform.ts`:
  - `amount: \`$${invoice.amount.toLocaleString('en-US', ...)}\``
- **Stripe pence amounts** already format as GBP `£` with `en-GB` in `src/modules/invoicing/utils/invoiceAmounts.ts` via `formatPence(pence)`.
- **Order totals** are formatted as GBP `£` with `en-GB` in `src/modules/orders/utils/orderCalculations.ts` (`getOrderTotalFormatted`).
- Multiple components include local “format pence” helpers (e.g. `InvoiceDetailSidebar.tsx` defines its own `formatPence`).

Observations:
- There is no single app-wide formatting API; multiple modules format currency differently.
- There are at least **two units** in use:
  - **Decimal pounds** (e.g. `orders.value`, `permit_cost`, etc.)
  - **Integer pence** (e.g. `invoices.amount_paid`, `amount_remaining`)

### Date formatting (current)

Existing patterns (non-exhaustive):
- Many places use `new Date(...).toLocaleDateString()` or `toLocaleString()`, which varies by user/device locale.
- Inbox conversation timestamps use relative text + locale fallback in `src/modules/inbox/utils/conversationUtils.ts`.
- Inbox message bubbles currently format timestamps as `DD/MM/YYYY HH:MM AM/PM` in `src/modules/inbox/components/ConversationThread.tsx` (`formatBubbleTimestamp`), which conflicts with the target `DD-MM-YYYY` requirement.

Observations:
- Date display is inconsistent between modules and even within the same module.
- Some screens need **date-only**; some need **date+time**. We should standardize the date portion while preserving time where it is meaningful.

---

## Recommended Schema Adjustments

### Database Changes

- **None.** This is display-only.

### Query/Data-Access Alignment

- Keep raw numeric and raw date/time values as-is.
- Apply formatting at the final presentation layer (transformers and table cell renderers), not in query filters.

---

## Implementation Approach

### Phase 1: Introduce shared formatting helpers

Create shared formatters in a single place (recommended):
- `src/shared/lib/formatters.ts` (new)

Provide clear, unit-safe APIs:

- **Currency**
  - `formatGbpDecimal(value: number | string | null | undefined): string`
    - For values stored as decimal pounds (e.g. order values, permit costs, additional options totals).
    - Output: `£1,234.56` or `—`.
  - `formatGbpPence(pence: number | null | undefined): string`
    - For values stored as integer pence (e.g. Stripe amounts).
    - Output: `£12.34` or `—`.

- **Dates**
  - `formatDateDMY(value: string | Date | null | undefined): string`
    - Output: `DD-MM-YYYY` (e.g. `06-03-2026`) or `—`.
  - `formatDateTimeDMY(value: string | Date | null | undefined, opts?: { includeSeconds?: boolean; amPm?: boolean }): string`
    - Output examples:
      - `06-03-2026 14:05` (24h)
      - or if AM/PM is retained by design choice: `06-03-2026 02:05 PM`

Implementation notes:
- Keep functions **pure** and deterministic.
- Avoid `toLocaleDateString()` without fixed options because it is locale-dependent.
- Use `en-GB` only for numeric formatting (commas/decimals), but format the date explicitly into `DD-MM-YYYY`.

### Phase 2: Replace module-local formatters with shared helpers (high-signal targets)

Currency targets (start with places known to be inconsistent):
- `src/modules/invoicing/utils/invoiceTransform.ts`
  - Replace `$` / `en-US` formatting for invoice amount with shared GBP formatter (decimal pounds).
- `src/modules/invoicing/utils/invoiceAmounts.ts`
  - Either re-export shared `formatGbpPence` or swap implementation to call the shared helper.
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
  - Remove local `formatPence` helper; use shared helper.
- `src/modules/orders/utils/orderCalculations.ts`
  - Ensure it uses the shared decimal GBP formatter for consistency (or keep as canonical and have shared helper call into it—prefer shared helper).
- Unified Inbox order context panel and other places displaying order totals/options/permit should rely on shared helper.

Date targets:
- Tables and detail panels that show invoice due dates, issue dates, payment dates:
  - Invoicing list/table cell renderers and detail sidebar.
- Orders pages showing dates (due date, installation date, deposit date, etc.).
- Inbox:
  - Conversation list timestamps: standardize date fallback to `DD-MM-YYYY` (keep relative “Just now / X mins ago” if desired; otherwise convert to absolute).
  - Message bubbles: standardize the date portion to `DD-MM-YYYY` and preserve time in the existing UI where it is currently shown.

### Phase 3: Guardrails (sorting/filtering)

- Ensure tables sort by **raw values**, not by formatted strings.
- If a table currently sorts by a formatted string (e.g. `amount` in `UIInvoice` is a string), do not change sorting behavior in this task unless there is a proven bug. Prefer display-only changes.
- For any new formatting added at transform layer, verify that existing code never uses those formatted fields for computation.

### Safety Considerations

- Don’t change data types returned from APIs; only change formatting at display edges.
- Add lightweight unit tests for formatters (optional but recommended) so the formatting rules stay stable.

---

## What NOT to Do

- Do not migrate stored units (do not convert pounds to pence or vice versa).
- Do not change Stripe webhooks, Stripe amount logic, or invoice totals computations.
- Do not change DB schema or add computed columns/views for formatting purposes.
- Do not change filter/sort semantics unless necessary to prevent a regression.

---

## Open Questions / Considerations

- **Relative times in Inbox**: keep “Just now / X mins ago” or switch to absolute `DD-MM-YYYY` everywhere? Requirement says date format, but relative time may still be acceptable if used consistently.
- **Date+time standard**: if time is displayed, should it be 24-hour (UK typical) or keep AM/PM? Requirement specifies date format only; propose 24-hour to reduce ambiguity.
- **Existing `$` in invoice list**: confirm invoice `amount` is stored as decimal pounds; display should become `£` with `en-GB`.

