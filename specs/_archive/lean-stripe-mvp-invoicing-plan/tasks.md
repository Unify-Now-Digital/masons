# Tasks: Lean Stripe MVP for Invoicing

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Add Stripe columns migration | Create | `supabase/migrations/..._add_stripe_columns_to_invoices.sql` | High | None | 1 |
| 2.1 | Create stripe-create-checkout-session function | Create | `supabase/functions/stripe-create-checkout-session/index.ts` | High | 1.1 | 2 |
| 2.2 | CORS + admin token + validate + load invoice/orders | Create | same | High | 2.1 | 2 |
| 2.3 | Create Stripe Session, update invoice, return url | Create | same | High | 2.2 | 2 |
| 3.1 | Create stripe-webhook function | Create | `supabase/functions/stripe-webhook/index.ts` | High | 1.1 | 3 |
| 3.2 | Verify signature, handle checkout.session.completed | Create | same | High | 3.1 | 3 |
| 4.1 | Create stripe.api.ts + createCheckoutSession | Create | `src/modules/invoicing/api/stripe.api.ts` | High | None | 4 |
| 4.2 | Extend Invoice types (Stripe fields) | Update | `src/modules/invoicing/types/invoicing.types.ts` | High | None | 4 |
| 4.3 | Copy payment link button in InvoiceDetailSidebar | Update | `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` | High | 4.1 | 4 |
| 4.4 | Stripe status pill (detail + optional list) | Update | InvoiceDetailSidebar + list | High | 4.2 | 4 |
| 4.5 | Post-payment refresh (?stripe=success) | Update | Invoicing route/page | High | 4.3 | 4 |
| 5.1 | .env.example + secrets checklist | Update | `.env.example` | Medium | None | 5 |
| 6.1 | Build + QA validation | Verify | - | High | All | 6 |

---

## Phase 1: Database Migration

### Task 1.1: Add Stripe columns migration

**Type:** CREATE  
**Priority:** High  
**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_stripe_columns_to_invoices.sql`

**Description:**
Add `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at` to `invoices`. Use `add column if not exists`. Add column comments.

**Acceptance Criteria:**
- [ ] Migration runs without error
- [ ] Existing rows unchanged; new columns nullable/default as spec
- [ ] No changes to views or totals logic

---

## Phase 2: Edge Function — stripe-create-checkout-session

### Task 2.1: Function shell

**Type:** CREATE  
**Priority:** High  
**File:** `supabase/functions/stripe-create-checkout-session/index.ts`

**Description:**
Create function with `Deno.serve`. CORS for `POST`/`OPTIONS`; handle OPTIONS → 200.

**Acceptance Criteria:**
- [ ] File created; CORS headers; OPTIONS handled

### Task 2.2: Auth, validation, DB load

**Type:** CREATE  
**Priority:** High  
**Dependencies:** 2.1

**Description:**
Validate `X-Admin-Token == INBOX_ADMIN_TOKEN`; 401 if not. Parse `{ invoice_id }`; 400 if invalid. Load invoice; 404 if missing. Load orders by `invoice_id`; compute total (same as `getOrderTotal`).

**Acceptance Criteria:**
- [ ] Token check; 401 on fail
- [ ] Invoice + orders loaded; total computed

### Task 2.3: Stripe Session + DB update + response

**Type:** CREATE  
**Priority:** High  
**Dependencies:** 2.2

**Description:**
Create Checkout Session `mode: 'payment'`, GBP. Set `metadata.invoice_id` and `payment_intent_data.metadata.invoice_id`. Set `success_url`/`cancel_url` via `APP_ORIGIN`. Update `invoices` with `stripe_checkout_session_id`, `stripe_status = 'pending'`. Return `{ url }`.

**Acceptance Criteria:**
- [ ] Session created; invoice updated; `url` returned

---

## Phase 3: Edge Function — stripe-webhook

### Task 3.1: Webhook shell

**Type:** CREATE  
**Priority:** High  
**File:** `supabase/functions/stripe-webhook/index.ts`

**Description:**
Create function. Read raw body; verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`. Use `constructEvent`/`constructEventAsync`. 400 if invalid.

**Acceptance Criteria:**
- [ ] Raw body; signature verified; 400 on invalid

### Task 3.2: Handle checkout.session.completed

**Type:** CREATE  
**Priority:** High  
**Dependencies:** 3.1

**Description:**
Read `invoice_id` from `session.metadata` or `payment_intent.metadata`. Update `invoices`: `stripe_status = 'paid'`, `paid_at`, `stripe_payment_intent_id`, `stripe_checkout_session_id` (if not set), `status = 'paid'`. Idempotent.

**Acceptance Criteria:**
- [ ] Invoice updated to paid; 200 returned; safe logging

---

## Phase 4: Frontend

### Task 4.1: Stripe API helper

**Type:** CREATE  
**Priority:** High  
**File:** `src/modules/invoicing/api/stripe.api.ts`

**Description:**
`createCheckoutSession(invoiceId)`: POST to `.../stripe-create-checkout-session` with `X-Admin-Token`, body `{ invoice_id }`. Return `{ url }`. Validate env vars; throw if missing.

**Acceptance Criteria:**
- [ ] Helper implemented; env validated

### Task 4.2: Invoice types

**Type:** UPDATE  
**Priority:** High  
**File:** `src/modules/invoicing/types/invoicing.types.ts`

**Description:**
Add `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at` to invoice type. Ensure fetch includes them.

**Acceptance Criteria:**
- [ ] Types updated; API returns new fields

### Task 4.3: Copy payment link button

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 4.1  
**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Add “Copy payment link” button. On click: `createCheckoutSession(invoice.id)` → copy `url` → toast. Error toast on fail. Disable/hide when `stripe_status === 'paid'` or `status === 'paid'`.

**Acceptance Criteria:**
- [ ] Button added; copy + toast; errors surfaced

### Task 4.4: Stripe status pill

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 4.2  
**Files:** `InvoiceDetailSidebar`; optionally list

**Description:**
Show pill for `stripe_status` (unpaid / pending / paid). Distinct styling.

**Acceptance Criteria:**
- [ ] Pill in detail view; optional in list

### Task 4.5: Post-payment refresh

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 4.3  
**File:** Invoicing route/page

**Description:**
On `?stripe=success&session_id=...` invalidate invoice (+ list) queries. Optionally “Payment successful” message.

**Acceptance Criteria:**
- [ ] Redirect triggers refresh; paid state shown

---

## Phase 5: Configuration

### Task 5.1: .env.example + secrets

**Type:** UPDATE  
**Priority:** Medium  
**File:** `.env.example`

**Description:**
Document `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_INBOX_ADMIN_TOKEN`. Note restart Vite. List Supabase secrets required.

**Acceptance Criteria:**
- [ ] Example updated; secrets documented

---

## Phase 6: QA & Validation

### Task 6.1: Build + QA

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
`npm run build` and `npx tsc --noEmit` pass. Manual: create link → pay → webhook → paid; no regressions.

**Acceptance Criteria:**
- [ ] Build passes
- [ ] Acceptance checklist from spec satisfied

---

## Progress Tracking

### Phase 1
- [X] Task 1.1: Add Stripe columns migration

### Phase 2
- [X] Task 2.1: Create stripe-create-checkout-session function
- [X] Task 2.2: CORS + admin token + validate + load
- [X] Task 2.3: Stripe Session + DB update + response

### Phase 3
- [X] Task 3.1: Create stripe-webhook function
- [X] Task 3.2: Verify signature + handle event

### Phase 4
- [X] Task 4.1: Stripe API helper
- [X] Task 4.2: Invoice types
- [X] Task 4.3: Copy payment link button
- [X] Task 4.4: Stripe status pill
- [X] Task 4.5: Post-payment refresh

### Phase 5
- [X] Task 5.1: .env.example + secrets

### Phase 6
- [X] Task 6.1: Build + QA
