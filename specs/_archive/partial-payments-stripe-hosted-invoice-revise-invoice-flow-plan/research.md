# Phase 0: Stripe Capability + Config (No Code)

## Objective

Confirm Stripe account supports partial payments on hosted invoice page and that we use the correct collection method. No code changes in this phase.

---

## 1. Stripe Dashboard Checks

### 1.1 Partial Payments

- **Where:** Stripe Dashboard → **Settings** → **Invoicing** (or **Billing** → **Invoicing**).
- **Action:** Confirm that **Partial payments** (or “Allow customers to pay part of an invoice”) is **enabled** for the account.
- **Why:** Without this, the hosted invoice page will not allow paying less than the full amount; the invoice would either be paid in full or not at all.

### 1.2 Hosted Invoice Page

- **Behavior:** After an invoice is finalized and sent, Stripe exposes `invoice.hosted_invoice_url`.
- **Check:** When creating/sending an invoice via API, confirm that the created/sent invoice object includes `hosted_invoice_url` after finalization (and after send, if applicable).
- **Usage:** The app will open this URL in a new tab for “Hosted Invoice Link” and “Request payment” (re-send uses the same URL).

---

## 2. Desired Stripe Model

### 2.1 Collection Method: `send_invoice`

- **Decision:** Use **`collection_method: 'send_invoice'`** (manual payments), **not** `charge_automatically`.
- **Implications:**
  - Customer pays on the Stripe-hosted invoice page when they choose.
  - No automatic charge on a payment method; staff “sends” the invoice and customer pays via the link.
  - Compatible with partial payments: multiple payments can be made against the same invoice until it is fully paid.

### 2.2 Single Invoice, Multiple Payments

- One Stripe Invoice per Mason “invoice” (until revised).
- Stripe records multiple payment intents/charges against that invoice as the customer makes partial payments.
- Invoice status in Stripe can be `draft`, `open`, `paid`, `void`, `uncollectible`; when partially paid, it typically remains `open` with `amount_paid` and `amount_remaining` populated.

---

## 3. Out of Scope (No Code in Phase 0)

- Implementing or changing Edge Functions.
- Changing database schema.
- Any frontend or webhook code.

---

## 4. Sign-Off for Phase 1

Before starting Phase 1 (database migrations and Edge Function changes):

- [ ] Partial payments confirmed enabled in Stripe Dashboard (Invoicing settings).
- [ ] Confirmed that finalized/sent invoices return a non-null `hosted_invoice_url`.
- [ ] Confirmed use of `collection_method: 'send_invoice'` for new invoices (to be implemented in Phase 2).
