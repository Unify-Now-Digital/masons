# Implement Invoice Soft Delete

## Overview

**Goal:** Ensure deleting an invoice never fails due to foreign key (FK) constraints by switching to a soft delete model using `invoices.deleted_at`, while keeping the user experience simple and predictable.

**Context:**
- Today, the app performs a hard delete on `invoices` from the frontend via Supabase JS.
- Invoices are referenced by `orders.invoice_id` and `invoice_payments.invoice_id`, plus any reporting views that read from `invoices`.
- A new Edge Function (`invoices-delete`) already encapsulates a safe delete flow that unlinks orders, deletes `invoice_payments`, and then deletes the invoice row; this can be simplified once soft delete is in place.

**Scope (this spec):**
- Database migration to add `invoices.deleted_at` and index it.
- Update all invoicing data access to ignore soft-deleted rows by default.
- Replace hard delete with soft delete (`deleted_at = now()`), optionally unlinking orders.
- Keep the UI behavior (dialog + toast + immediate row removal) but route it through the new soft delete semantics.

Out of scope:
- Restore / undo deleted invoices.
- Admin “trash” view or bulk delete.

---

## Current State Analysis

### Schema and Relationships

**Table:** `public.invoices`

Key columns (relevant here):
- `id uuid primary key`
- `user_id uuid` (nullable, used for ownership / RLS)
- `invoice_number text`
- `customer_name text`
- `amount numeric(10,2)`
- `status text` (`draft` | `pending` | `paid` | `overdue` | `cancelled`, etc.)
- Stripe-related columns: `stripe_invoice_id`, `stripe_invoice_status`, `amount_paid bigint`, `amount_remaining bigint`, `hosted_invoice_url text`, `locked_at timestamptz`
- Timestamps: `created_at`, `updated_at`
- No `deleted_at` column yet.

Related tables:
- `public.orders`
  - `invoice_id uuid null` → links orders to invoices.
- `public.invoice_payments`
  - `invoice_id uuid not null` → payments recorded against invoices.

Implications:
- A direct `delete from invoices where id = ...` can fail with FK violations if:
  - There are `orders` rows pointing to the invoice and `ON DELETE` is `RESTRICT`.
  - There are `invoice_payments` rows pointing to the invoice.
- Hard delete via the public Supabase client is also subject to RLS; the service-role Edge Function currently bypasses RLS but still must deal with FKs.

### Data Access in Frontend

**APIs / hooks:**
- `src/modules/invoicing/api/invoicing.api.ts`
  - `fetchInvoices()`: `from('invoices').select('*').order('created_at', { ascending: false })`
  - `fetchInvoice(id)`: fetches a single row by `id`.
  - `deleteInvoice(id)`: now calls the `invoices-delete` Edge Function (service role) which:
    - Voids Stripe invoice if open/draft (best effort).
    - Unlinks `orders.invoice_id`, deletes `invoice_payments`, then hard-deletes the invoice.
- `src/modules/invoicing/hooks/useInvoices.ts`
  - `useInvoicesList()` uses `fetchInvoices`.
  - `useInvoice(id)` uses `fetchInvoice`.
  - `useDeleteInvoice()` wraps `deleteInvoice` and invalidates list + removes detail cache.

**UI:**
- `InvoicingPage.tsx`
  - Renders invoices table backed by `useInvoicesList` and `transformInvoicesForUI`.
  - Uses `<DeleteInvoiceDialog>` to confirm delete.
  - If the deleted invoice matches `selectedInvoice`, it clears the sidebar selection.
- `DeleteInvoiceDialog.tsx`
  - Calls `useDeleteInvoice` mutation.
  - Shows success and error toasts.

### Existing Delete Edge Function (`invoices-delete`)

**File:** `supabase/functions/invoices-delete/index.ts`

Behavior:
- Auth: validates `X-Admin-Token == INBOX_ADMIN_TOKEN`.
- Loads invoice by `id`.
- Best-effort void of linked Stripe invoice if still `draft` or `open`.
- DB mutations:
  - `orders.invoice_id = null` where `invoice_id = <id>`.
  - `delete from invoice_payments where invoice_id = <id>`.
  - `delete from invoices where id = <id>`.

This function currently implements a hard delete with cleanup. Soft delete will let us simplify this path and remove the need to delete rows from child tables.

---

## Requirements

### Functional Requirements

1. **Soft delete column and index**
   - Add `deleted_at timestamptz null` to `public.invoices`.
   - Add a B-tree index on `deleted_at` to support potential future queries (e.g. listing recently deleted invoices) and partial indexes if needed.

2. **Data access must ignore soft-deleted invoices by default**
   - Invoice list queries (`fetchInvoices`) must only return invoices where `deleted_at is null`.
   - Invoice detail fetch (`fetchInvoice`) must:
     - Either raise a “not found” error if `deleted_at is not null`, or
     - Map such rows to a clear “Deleted” UI state.
   - For this spec we standardise on **404 / not found** semantics: soft-deleted invoices cannot be loaded via the normal detail route.

3. **Delete flow uses soft delete**
   - Replace hard delete logic with:
     - `update invoices set deleted_at = now(), updated_at = now() where id = <invoice_id>`.
   - Decide how to handle linked data:
     - Option A: leave `orders.invoice_id` and `invoice_payments.invoice_id` intact; they refer to a soft-deleted invoice that is hidden from normal UI.
     - Option B: additionally set `orders.invoice_id = null`.
   - For this spec we will:
     - Perform **soft delete only** (no unlinking) initially.
     - Optionally add a follow-on step to set `orders.invoice_id = null` if this proves necessary for reporting or UX.

4. **User experience remains the same**
   - Delete dialog still appears and confirms “This action cannot be undone.”
   - On success:
     - Show success toast.
     - Refresh invoice list (row disappears).
     - If the invoice is open in the sidebar, close it / clear selection.
   - On failure:
     - Show descriptive error message from API/Edge Function.

### Non-Functional Requirements

- **Safety:**
  - Deletion should never fail due to FK constraints (because we no longer hard delete the invoice or child rows).
  - Edge Functions should remain idempotent: calling soft delete multiple times is safe (no new side effects after the first call).
- **Performance:**
  - `deleted_at` index ensures any future queries or maintenance operations (e.g. background archival) can filter efficiently.
- **Auditability:**
  - Soft-deleted rows remain in `invoices` with their existing metadata (amounts, statuses, Stripe IDs) for potential future analysis / export.

---

## Proposed Design

### Database Migration

**Migration steps:**
1. Alter `public.invoices`:
   - `alter table public.invoices add column if not exists deleted_at timestamptz null;`
2. Add index:
   - `create index if not exists invoices_deleted_at_idx on public.invoices (deleted_at);`

**RLS / permissions:**
- No RLS changes required for soft delete column itself.
- Existing Edge Functions that use service-role keys bypass RLS as before.

### Data Access Changes

1. **Invoice list (`fetchInvoices`)**
   - Change query to:
     - `.from('invoices').select('*').is('deleted_at', null).order('created_at', { ascending: false })`
   - This ensures soft-deleted invoices never show in the table.

2. **Invoice detail (`fetchInvoice`)**
   - Change query to:
     - Either filter `deleted_at is null` directly (preferred), e.g.:
       - `.eq('id', id).is('deleted_at', null).single()`
     - Or fetch by `id` and check `deleted_at` in code, throwing an “invoice not found” error if it is set.
   - Surface not-found as a standard error that the detail view / sidebar can handle (e.g. by closing and showing a toast, or fallback UI).

3. **Transform functions and hooks**
   - `transformInvoiceForUI` and `useInvoicesList` do not need to know about soft delete if queries already filter `deleted_at is null`.
   - Any future “admin/trash” views can re-use the same transform logic on a query that includes deleted rows.

### Delete Flow (Soft Delete)

**Backend: Edge Function `invoices-delete`**

Refactor `supabase/functions/invoices-delete/index.ts` to:
- Maintain the same **external API**:
  - `POST /invoices-delete` with `{ invoice_id }` and `X-Admin-Token`.
- Internal behavior changes:
  1. Load invoice (`id, stripe_invoice_id, stripe_invoice_status, deleted_at`).
  2. If `deleted_at` is already set:
     - Return 200 `{ success: true }` (idempotent).
  3. Best-effort Stripe void remains:
     - If Stripe invoice exists and status in (`draft`, `open`), attempt `voidInvoice`.
  4. Soft delete instead of hard delete:
     - `update invoices set deleted_at = now(), updated_at = now() where id = <id>;`
     - Do **not** delete `invoice_payments` or unlink `orders` in this version to keep data intact.
  5. Return `{ success: true }` on success.

Rationale:
- This keeps the endpoint semantics stable for the frontend while avoiding FK issues.
- It leaves relational integrity intact; future reporting or admin functionality can decide how to surface soft-deleted invoices and their payments.

**Frontend: `deleteInvoice` API helper**

- Keep the current call to `invoices-delete` Edge Function; no signature change required.
- Rely on the function’s updated behavior to perform soft delete.
- Continue to:
  - Throw `Error` with meaningful message if response is non-2xx.

**React Query hook `useDeleteInvoice`**

- Behavior remains:
  - Mutates via `deleteInvoice(id)`.
  - On success:
    - Invalidates `invoicesKeys.all` so the list refetches without the soft-deleted row.
    - Removes `invoicesKeys.detail(id)` from cache to avoid stale details.

### UI Behavior

**Delete dialog (`DeleteInvoiceDialog`)**

- No textual changes needed: “This action cannot be undone” remains accurate in practice even with soft delete (no restore path).
- On success:
  - Keep existing success toast (“Invoice deleted”).
  - Close dialog.
  - Invoke `onDeleted(invoice.id)` to let the parent close the sidebar if it is showing that invoice.

**Invoicing page (`InvoicingPage`)**

- Already wired to:
  - Clear `selectedInvoice` if the deleted invoice was open in the sidebar.
  - Refetch the list via React Query invalidation.
- With soft delete in place, user experience remains:
  - Row disappears from table.
  - Sidebar closes if it was open.

---

## Implementation Plan

### Phase 1 — Database Migration

- [ ] Add `deleted_at timestamptz null` to `public.invoices`.
- [ ] Add `invoices_deleted_at_idx` on `deleted_at`.
- [ ] Deploy migration to all environments.

### Phase 2 — Backend: Edge Function Update

- [ ] Update `invoices-delete` Edge Function to:
  - [ ] Short-circuit if `deleted_at` is already set (idempotent).
  - [ ] Keep best-effort Stripe void for open/draft invoices.
  - [ ] Perform `update invoices set deleted_at = now(), updated_at = now()` instead of deleting.
  - [ ] Stop deleting `invoice_payments` and unlinking `orders` (leave data intact).
- [ ] Add logging that is safe (no secrets) but sufficient for debugging.

### Phase 3 — Frontend: Data Access & UI

- [ ] Update `fetchInvoices` to filter `deleted_at is null`.
- [ ] Update `fetchInvoice` to filter `deleted_at is null` (and treat missing row as not found).
- [ ] Confirm `useInvoicesList` and `useInvoice` behave correctly with new semantics.
- [ ] Confirm `useDeleteInvoice` still invalidates list + clears detail cache.
- [ ] Verify `DeleteInvoiceDialog` and `InvoicingPage` close the sidebar when the current invoice is deleted.

### Phase 4 — QA

- [ ] Delete an invoice with linked orders and `invoice_payments`; verify:
  - [ ] API returns success.
  - [ ] Row disappears from list.
  - [ ] Sidebar closes if open.
  - [ ] Child rows remain in DB (orders still reference invoice; payments remain).
- [ ] Attempt to fetch deleted invoice by direct URL / detail view; verify:
  - [ ] It returns “not found” / fails gracefully in UI.
- [ ] Delete an invoice with a Stripe invoice in `draft` or `open` status; verify:
  - [ ] Stripe invoice is voided when possible (logs show success; manual Stripe dashboard check in test mode).
  - [ ] Local invoice is soft-deleted even if Stripe void fails (best-effort).
- [ ] Delete the same invoice twice:
  - [ ] Second call is effectively a no-op and still returns success.

---

## Risks and Mitigations

- **Risk:** Hidden invoices may still be referenced by orders and payments, complicating future reporting.
  - **Mitigation:** This is acceptable for now; soft delete is primarily a safety feature. Future reporting work can introduce explicit filters or trash views.

- **Risk:** Some legacy or ad-hoc queries might not filter `deleted_at is null` and could show soft-deleted invoices.
  - **Mitigation:** Audit any direct queries (especially in reporting / exports) when implementing this spec and add filters where appropriate.

- **Risk:** Stripe invoice void may fail (e.g. already paid or invalid state).
  - **Mitigation:** Continue best-effort void; log errors; soft delete locally regardless.

---

## Acceptance Criteria

- Invoices table:
  - Soft-deleted invoices no longer appear in the list or sidebar.
  - Deleting an invoice never fails due to FK constraints.
- Backend:
  - `invoices` has a nullable `deleted_at` column with an index.
  - `invoices-delete` performs soft delete (`deleted_at` set) and leaves child rows intact.
  - Calling `invoices-delete` twice for the same `invoice_id` is safe and returns success.
- Frontend:
  - Delete action triggers soft delete via the Edge Function.
  - On success, the invoice row disappears and any open sidebar for that invoice closes.
  - Attempting to open a soft-deleted invoice by URL results in a “not found” experience (no broken UI).
- No regressions to partial payments, Stripe status, or invoicing UX introduced by the change.

---

**Spec Status:** Ready for implementation  
**Branch:** `feature/partial-payment-checkout-link`

