# Implementation Plan: Partial Payments + Revise Invoice Flow

**Feature spec:** [partial-payments-stripe-hosted-invoice-revise-invoice-flow.md](../partial-payments-stripe-hosted-invoice-revise-invoice-flow.md)  
**Branch:** `feature/partial-payments-stripe-hosted-invoice-revise-flow`

**Note:** `.specify/scripts/bash/setup-plan.sh` was not present; paths were set from user input: FEATURE_SPEC = spec above, SPECS_DIR = this folder, IMPL_PLAN = this file.

## Technical Context (from $ARGUMENTS)

- Implement partial payments on Stripe-hosted invoice page (single Stripe Invoice, multiple payments).
- Lock editing and provide "Revise invoice" (void + recreate) flow once any payment exists.
- Phases: 0 (Stripe capability/config), 1 (DB migrations), 2 (Edge Functions create/send/fetch), 3 (Webhook sync), 4 (Frontend), 5 (Revise invoice flow).
- Testing checklist and RLS for all new tables/fields.

## Progress Tracking

| Phase | Status    | Artifact(s) |
|-------|-----------|--------------|
| Phase 0 | COMPLETE | research.md |
| Phase 1 | COMPLETE | data-model.md, contracts/, quickstart.md |
| Phase 2 | COMPLETE | tasks.md |
| Verify | COMPLETE | All artifacts generated, no ERROR states |

## Execution Summary

- **Phase 0:** Stripe Dashboard checks and desired model (send_invoice, partial payments, hosted page) documented in research.md.
- **Phase 1:** Schema changes (invoices columns, invoice_payments table, RLS), API/Edge Function contracts, quickstart for local and Stripe config.
- **Phase 2:** Task list for migrations, Edge Functions, webhook, frontend, revise flow, and QA.
