# Research: Organisation-Scoped Insert Stamp Audit (013-org-id-stamp-audit)

**Date**: 2026-06-12

## R1 — Root cause of silent data loss

**Decision**: Inserts omitting `organization_id` fail Postgres RLS policy `WITH CHECK (user_is_member_of_org(organization_id))` because `user_is_member_of_org(NULL)` evaluates false → error **42501**. Some call sites only `console.error` or swallow errors, so UI shows success while no row is written.

**Rationale**: Confirmed in production for `order_additional_options` and `order_people`; fixed by loading parent `orders.organization_id` before insert in `orders.api.ts`.

**Alternatives considered**:
- **Relax RLS policies**: rejected per spec (policies are correct).
- **DB trigger to auto-fill org from parent FK**: rejected (no schema migrations in scope).

## R2 — Authoritative org source by entity type

**Decision**:

| Entity class | Org source | Pattern |
|--------------|------------|---------|
| Top-level (products, cemeteries, companies, table_view_presets, invoices) | `OrganizationContext.organizationId` | Pass as second arg or read in hook; API throws if null |
| Order child (inscriptions) | `orders.organization_id` via `order_id` | Single-row select before insert |
| Conversation child (inbox_messages) | `inbox_conversations.organization_id` via `conversation_id` | Single-row select before insert |
| Invoice child (invoice_payments) | `invoices.organization_id` or webhook URL org | Pass into helper at all Edge call sites |

**Rationale**: Matches already-shipped fixes in `upsertOrderPeople` and `createAdditionalOption`; never trust user-editable payload fields alone.

**Alternatives considered**:
- **Denormalize org on client from context for child rows without lookup**: rejected — conversation/order context may not be in React state at save time; parent DB row is authoritative.

## R3 — Service-role Edge inserts vs org RLS

**Decision**: `stripe-webhook` uses `serviceSupabase()` which **bypasses RLS on INSERT**. Missing `organization_id` on `invoice_payments` may not throw 42501 but produces rows with `organization_id IS NULL` that **fail org-scoped SELECT** for authenticated staff (`user_is_member_of_org(NULL)` = false). Fix by stamping org on every insert for data integrity and finance visibility.

**Rationale**: FR-011 requires explicit stamp or documented bypass; explicit stamp is preferred for consistent tenant data.

**Alternatives considered**:
- **Leave null because service role bypasses insert RLS**: rejected — breaks staff-facing payment history queries.

## R4 — Pre-audit code inventory (src/)

**Decision**: Grep + manual read identified **4 fix targets** and **6 verify-only** tables (see plan.md inventory).

**Confirmed broken (src/)**:
- `useInscriptions.ts` — `createInscription` inserts without org
- `inboxMessages.api.ts` / `useSaveInternalNote` — internal note insert without org
- `tableViewPresets.api.ts` — create/fetch without org scope
- `invoicing.api.ts` — `createInvoice` does not enforce org (caller-dependent)

**Confirmed broken (Edge)**:
- `stripe-webhook/index.ts` — `insertInvoicePaymentOnce` missing `organization_id` (3 call sites); checkout path inline insert at line ~392 already includes `organization_id: urlOrganizationId`

**Confirmed correct (verify only)**:
- `useCemeteries.ts`, `useCompanies.ts`, `useProducts.ts`, `usePayments.ts`, `permitForms.api.ts`, `inboxConversations.api.ts`

**Alternatives considered**:
- **Audit Edge inbox_* functions**: out of spec scope except `invoice_payments`; inbox Edge writes use service role and are not in FR-002 acceptance criteria for src/ inserts.

## R5 — Invoice create defensive stamping

**Decision**: Refactor `createInvoice(invoice, organizationId: string)` to always set `organization_id` from the second parameter, overriding any caller-provided value. `useCreateInvoice` passes `organizationId` from `useOrganization()` and throws if unset.

**Rationale**: Single API entry point; `CreateInvoiceDrawer` already sets org on payload but hook does not enforce — defensive API prevents future callers from regressing.

**Alternatives considered**:
- **Validate only if missing on payload**: weaker; allows wrong org in payload if caller bugs.

## R6 — table_view_presets org scoping

**Decision**: Add `organization_id` to insert **and** filter `fetchPresetsByModule(module, organizationId)` by org. Update React Query keys to include org id.

**Rationale**: Without fetch filter, presets saved after fix would be org-stamped but legacy cross-org rows could still appear; new saves without org fail RLS.

**Alternatives considered**:
- **Insert-only fix**: insufficient for correct tenant isolation in preset picker UI.

## R7 — Error surfacing standard

**Decision**: Authenticated client paths MUST `throw error` (or rethrow as `Error`) on insert failure so TanStack Query mutations surface toast/UI failure. Edge `insertInvoicePaymentOnce` keeps idempotent 23505 swallow but logs other errors; primary fix is successful insert with org stamp.

**Rationale**: FR-009; reference hooks (`useCreateCemetery`, `usePayments`) already throw on error.

## R8 — Test organisation selection

**Decision**: Use **Sears Melvin** (`3770972d-1bbd-417b-b413-297e844db285`) for throwaway inbox/message tests; **Churchill** for order/invoice flows where production parity matters.

**Rationale**: User-specified risk note for live Churchill inbox data.
