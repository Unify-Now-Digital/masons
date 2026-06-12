# Data Model: Organisation Insert Stamp Audit (013-org-id-stamp-audit)

**No schema changes.** This document describes existing columns and the required insert contract.

## Shared concept: organisation scope

All in-scope tables have:

| Column | Type | Role |
|--------|------|------|
| `organization_id` | `uuid` → `organizations(id)` | Tenant key; RLS insert check uses `user_is_member_of_org(organization_id)` |

Authenticated inserts **must** set this column to a non-null UUID the current user is a member of.

## Parent → child relationships (org derivation)

```text
organizations
    ├── orders ──────────────┬── inscriptions (order_id)
    │                        └── (reference: order_people, order_additional_options — fixed)
    ├── inbox_conversations ── inbox_messages (conversation_id)
    ├── invoices ──────────────┬── payments (invoice_id) — org also from context at insert
    │                          └── invoice_payments (invoice_id) — Edge + org from invoice
    └── (top-level) ─────────── products, cemeteries, companies, permit_forms, table_view_presets
                                 org from OrganizationContext at insert
```

## In-scope tables

### Top-level (org from OrganizationContext)

| Table | Insert site | Notes |
|-------|-------------|-------|
| `cemeteries` | `useCemeteries.createCemetery` | Already stamps |
| `companies` | `useCompanies.createCompany` | Already stamps |
| `products` | `useProducts.createProduct` | Already stamps |
| `permit_forms` | `permitForms.api.createPermitForm` | Already stamps |
| `table_view_presets` | `tableViewPresets.api.createPreset` | **Fix** + scope fetch |
| `invoices` | `invoicing.api.createInvoice` | **Fix** — enforce context org |
| `payments` | `usePayments.createPayment` | Already stamps (context org) |

### Child (org from parent lookup)

| Table | Parent | FK | Insert site |
|-------|--------|-----|-------------|
| `inscriptions` | `orders` | `order_id` | `useInscriptions.createInscription` |
| `inbox_messages` | `inbox_conversations` | `conversation_id` | `inboxMessages.api.createMessage` |
| `invoice_payments` | `invoices` | `invoice_id` | `stripe-webhook.insertInvoicePaymentOnce` |

### Conversation root (org on row)

| Table | Insert site | Notes |
|-------|-------------|-------|
| `inbox_conversations` | `inboxConversations.api.createConversation` | Already sets `organization_id` from payload |

## Reference implementations (do not rework)

### `order_people` — parent order lookup

```typescript
const { data: opOrder } = await supabase
  .from('orders')
  .select('organization_id')
  .eq('id', orderId)
  .single();
if (!opOrder?.organization_id) throw new Error('Order has no organization_id');

await supabase.from('order_people').insert({
  ...row,
  organization_id: opOrder.organization_id,
});
```

### `order_additional_options` — same pattern

See `src/modules/orders/api/orders.api.ts` — `createAdditionalOption`.

## Validation rules (application layer)

1. **Top-level insert**: `organizationId` parameter required; throw `'No organization selected'` if null/empty.
2. **Child insert**: Parent lookup required; throw if parent missing or parent.`organization_id` null.
3. **Never** accept `organization_id` from unvalidated user form input without matching context or parent.
4. **Never** hard-code organisation UUIDs in application code (test org ids only in quickstart docs).

## Out of scope tables (no org-scoped INSERT policy)

`job_workers`, `jobs`, `memorials`, `messages`, `order_comments`, `worker_availability`, `workers` — inserts may omit org; not audited for stamping.

## Verify-only

| Table | Expected behaviour |
|-------|-------------------|
| `orders` | `createOrder(order, organizationId)` spreads `organization_id: organizationId` |
