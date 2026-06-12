# Implementation Plan: Organisation-Scoped Insert Stamp Audit

**Branch**: `013-org-id-stamp-audit` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/013-org-id-stamp-audit/spec.md`

## Summary

Audit every **authenticated client insert** into the 11 organisation-scoped tables listed in the spec, ensure each payload includes `organization_id` sourced from the **parent record** (order, invoice, conversation) or **OrganizationContext** (top-level entities), and fix paths that omit it. **No RLS, schema, or `user_is_member_of_org` changes.** Reference implementations already exist in `orders.api.ts` (`upsertOrderPeople`, `createAdditionalOption`).

Pre-audit finding: **4 tables need code fixes**, **6 are likely correct** (verify-only), **1 edge-function path** (`insertInvoicePaymentOnce`) needs org stamping for data visibility under org RLS even though service-role bypasses insert RLS.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React 18); Deno (Supabase Edge Functions — `invoice_payments` only)  
**Primary Dependencies**: `@supabase/supabase-js`, TanStack React Query, `OrganizationContext`  
**Storage**: PostgreSQL (Supabase) — existing `organization_id` columns; RLS `WITH CHECK (user_is_member_of_org(organization_id))` on scoped tables  
**Testing**: `npm run lint`; manual per-table verification via [quickstart.md](./quickstart.md)  
**Target Platform**: Vite web app (`src/`) + `supabase/functions/stripe-webhook`  
**Project Type**: Brownfield audit/fix — no migrations  
**Performance Goals**: One extra parent lookup per child insert (acceptable; matches existing order_people pattern)  
**Constraints**: Fail closed; no hard-coded org UUIDs; surface errors to UI on corrected paths; coordinate `invoice_payments` with 012-per-org-stripe (single fix)  
**Scale/Scope**: 11 tables; ~6 source files to change; 6 verify-only tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| Dual router (`src/app/` + `src/pages/`) | **Pass** | No route changes |
| Module boundaries | **Pass** | Fixes localized to owning module APIs/hooks |
| Supabase + RLS | **Pass** | RLS unchanged; fixes align inserts with existing policies |
| Secrets server-side | **Pass** | N/A — no new secrets |
| Additive-first | **Pass** | Application-layer only; no schema |

**Post-design re-check**: **Pass** — stamp pattern reuses established order-child lookup; no policy bypass for authenticated users.

## Phase 0: Research

See [research.md](./research.md). All audit unknowns resolved; no NEEDS CLARIFICATION remain.

## Phase 1: Design artifacts

| Artifact | Purpose |
|----------|---------|
| [data-model.md](./data-model.md) | Org stamp sources per table; reference entities |
| [contracts/org-stamp-insert.md](./contracts/org-stamp-insert.md) | Required insert contract for authenticated + service paths |
| [quickstart.md](./quickstart.md) | Per-table verification steps, test orgs, grep audit |

## Pre-Audit Inventory (src/ insert sites)

| Table | Primary file | Pre-audit status | Action |
|-------|--------------|------------------|--------|
| cemeteries | `src/modules/cemeteries/hooks/useCemeteries.ts` | ✅ Stamps via `organizationId` param | Verify |
| companies | `src/modules/companies/hooks/useCompanies.ts` | ✅ Stamps via context | Verify |
| inbox_conversations | `src/modules/inbox/api/inboxConversations.api.ts` | ✅ `organization_id` on row | Verify |
| inbox_messages | `src/modules/inbox/api/inboxMessages.api.ts`, `useInboxMessages.ts` | ❌ `useSaveInternalNote` omits org | **Fix** — parent conversation lookup |
| inscriptions | `src/modules/inscriptions/hooks/useInscriptions.ts` | ❌ No org on insert | **Fix** — parent order lookup |
| invoices | `src/modules/invoicing/api/invoicing.api.ts` | ⚠️ Relies on caller passing org | **Fix** — enforce in API + hook |
| payments | `src/modules/payments/hooks/usePayments.ts` | ✅ Stamps via context | Verify |
| permit_forms | `src/modules/permitForms/api/permitForms.api.ts` | ✅ Stamps via param | Verify |
| products | `src/modules/products/hooks/useProducts.ts` | ✅ Stamps via context | Verify |
| table_view_presets | `src/shared/tableViewPresets/api/tableViewPresets.api.ts` | ❌ No org on insert; fetch not org-scoped | **Fix** — context stamp + fetch filter |
| invoice_payments | `supabase/functions/stripe-webhook/index.ts` | ❌ `insertInvoicePaymentOnce` omits org | **Fix** — stamp from invoice / URL org |
| orders | `src/modules/orders/api/orders.api.ts` | ✅ `createOrder(..., organizationId)` | Verify only |
| order_people / order_additional_options | `src/modules/orders/api/orders.api.ts` | ✅ Reference pattern | Exclude |

## Project Structure

### Documentation (this feature)

```text
specs/013-org-id-stamp-audit/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── org-stamp-insert.md
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit.tasks (next command)
```

### Source Code (changes expected)

```text
src/
├── modules/
│   ├── inscriptions/hooks/useInscriptions.ts          # FIX — order parent lookup
│   ├── invoicing/
│   │   ├── api/invoicing.api.ts                       # FIX — enforce org on createInvoice
│   │   └── hooks/useInvoices.ts                       # FIX — pass organizationId
│   └── inbox/
│       ├── api/inboxMessages.api.ts                   # FIX — optional helper with conversation lookup
│       └── hooks/useInboxMessages.ts                  # FIX — useSaveInternalNote
└── shared/
    └── tableViewPresets/
        ├── api/tableViewPresets.api.ts                # FIX — org stamp + scoped fetch
        └── hooks/useTableViewPresets.ts               # FIX — wire OrganizationContext

supabase/functions/
└── stripe-webhook/index.ts                            # FIX — insertInvoicePaymentOnce + callers
```

**Structure Decision**: Fix at the **API layer** (same as `orders.api.ts` reference) so all callers inherit correct stamping; hooks pass `organizationId` from context for top-level entities.

## Implementation Phases (for /speckit.tasks)

### Phase A — Reference verification (P2, quick)

1. Confirm `createOrder`, `upsertOrderPeople`, `createAdditionalOption` unchanged and passing
2. Grep audit: `rg "\.insert\(" src/` cross-checked against in-scope tables (see quickstart)
3. Mark verify-only tables pass/fail in tasks

### Phase B — Child-table fixes (P1)

1. **inscriptions**: In `createInscription`, if `order_id` present, select `orders.organization_id`; throw if missing; insert with stamp
2. **inbox_messages**: In `createMessage` or `useSaveInternalNote`, select `inbox_conversations.organization_id` by `conversation_id`; stamp insert
3. **invoice_payments**: Extend `insertInvoicePaymentOnce` opts with `organization_id`; pass from invoice row or `urlOrganizationId` at all 3 call sites; consolidate checkout inline insert to use helper

### Phase C — Top-level / defensive fixes (P1)

1. **invoices**: Change `createInvoice(invoice, organizationId)` — stamp `{ ...invoice, organization_id: organizationId }`; throw if no org; update `useCreateInvoice` to pass context org (CreateInvoiceDrawer may omit redundant field)
2. **table_view_presets**: Add `organizationId` to `createPreset` and `fetchPresetsByModule`; wire `useTableViewPresets` + `PresetsTab` query keys with org

### Phase D — Verify-only confirmation (P1)

Manual pass for: cemeteries, companies, inbox_conversations, payments, permit_forms, products, orders — document in quickstart checklist

### Phase E — Error surfacing (P2)

On newly fixed paths, ensure insert errors propagate to UI (mutations throw; no silent `console.error` only). `insertInvoicePaymentOnce` may keep console log but should include org in payload so insert succeeds.

## Complexity Tracking

No constitution violations requiring justification.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Churchill live inbox pollution during test | Use Sears Melvin org `3770972d-1bbd-417b-b413-297e844db285` for throwaway inbox rows |
| Duplicate invoice_payments fix with 012 Stripe work | Single change in `insertInvoicePaymentOnce`; checkout path already stamps inline — unify |
| table_view_presets fetch returns cross-org presets | Add `.eq('organization_id', organizationId)` to fetch + update unset-default queries |
| Parent order/conversation missing org | Throw explicit error before insert (AC-004) |
| Service-role webhook inserts “work” without org but rows invisible to staff | Stamp org for SELECT RLS visibility and finance views |

## Next command

`/speckit.tasks` — break phases A–E into ordered, per-table tasks with verification steps.
