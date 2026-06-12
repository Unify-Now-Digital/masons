# Quickstart: Organisation Insert Stamp Audit (013-org-id-stamp-audit)

**Branch**: `013-org-id-stamp-audit`

## Prerequisites

- Local dev server: `npm run dev`
- Signed-in user with membership in test orgs
- Browser DevTools → Network tab (filter Supabase REST / `insert`)
- Optional: Supabase dashboard → Table Editor for row confirmation

### Test organisations

| Org | UUID | Use for |
|-----|------|---------|
| Sears Melvin (throwaway) | `3770972d-1bbd-417b-b413-297e844db285` | Inbox conversations/messages, generic tests |
| Churchill | (production pilot) | Order/invoice flows where parity matters — avoid throwaway inbox noise |

## Code audit (before manual test)

From repo root:

```bash
# All insert call sites in src/
rg "\.insert\(" src/ --glob "*.{ts,tsx}"

# Cross-check in-scope tables
rg "from\('(cemeteries|companies|inbox_conversations|inbox_messages|inscriptions|invoices|payments|permit_forms|products|table_view_presets)'\)" src/

# Edge invoice_payments
rg "invoice_payments" supabase/functions/
```

Every in-scope insert MUST include `organization_id` in the payload or via spread from a stamped object.

## Per-table verification checklist

Switch to the appropriate org in the workspace switcher before each test. After each action: confirm **no 42501** in network response; confirm row in table editor with `organization_id` populated.

### Verify-only (expected already correct)

- [ ] **orders** — Create order; row has active org id
- [ ] **cemeteries** — Settings/Permits → add cemetery
- [ ] **companies** — Add company
- [ ] **products** — Add product
- [ ] **payments** — Record manual payment on invoice
- [ ] **permit_forms** — Add permit form template
- [ ] **inbox_conversations** — New conversation modal (prefer Sears Melvin)

### Fix + verify

- [ ] **inscriptions** — Open order → add inscription → reload order → inscription visible
- [ ] **invoices** — Create invoice drawer → appears in invoice list for active org
- [ ] **table_view_presets** — Orders/Invoices table → save column preset → reload page → preset persists for this org only
- [ ] **inbox_messages** — Add internal note on conversation (Sears Melvin) → note visible in thread
- [ ] **invoice_payments** — Complete Stripe test payment → payment row in `invoice_payments` with org id; visible in invoice payment history UI

### Reference (exclude from fix work)

- [ ] **order_additional_options** — Add option on order → persists (regression)
- [ ] **order_people** — Assign customer on order → persists (regression)

## Stripe webhook verification (invoice_payments)

1. Use test-mode invoice for a known org with `organization_id` set
2. Complete checkout or hosted invoice payment
3. Check Edge Function logs — no `invoice_payments insert error` without org
4. SQL spot check:

```sql
select id, invoice_id, organization_id, amount, status
from public.invoice_payments
where invoice_id = '<INVOICE_UUID>'
order by created_at desc
limit 5;
```

`organization_id` must match the invoice's organisation.

## Failure signatures

| Symptom | Likely cause |
|---------|--------------|
| Postgres 42501 on insert | Missing or null `organization_id` |
| UI success but no row | Error swallowed (console only) |
| Row exists but staff cannot see payment | `organization_id` null on `invoice_payments` |
| Preset saved but wrong org sees it | Fetch not filtered by `organization_id` |

## Lint

```bash
npm run lint
```

## Rollback

Revert application commits only — no migration rollback required.
