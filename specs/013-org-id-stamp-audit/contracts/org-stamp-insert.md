# Contract: Organisation-stamped inserts (authenticated client)

**Feature**: 013-org-id-stamp-audit  
**Applies to**: All `supabase.from(<table>).insert(...)` calls in `src/` for in-scope tables

## Requirement

Every insert into an organisation-scoped table MUST include:

```typescript
organization_id: string  // non-null UUID
```

Sourced from one of:

| Source | When |
|--------|------|
| Function parameter `organizationId` | Top-level creates (products, cemeteries, companies, invoices, presets, payments, permit forms) |
| Parent record lookup | Child creates (inscriptions ← order, inbox_messages ← conversation) |

## API function signatures (target state)

### Top-level pattern

```typescript
export async function createEntity(
  payload: EntityInsert,
  organizationId: string,
): Promise<Entity> {
  if (!organizationId) throw new Error('No organization selected');
  const { data, error } = await supabase
    .from('entities')
    .insert({ ...payload, organization_id: organizationId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

Hook MUST obtain `organizationId` from `useOrganization()` and throw if unset before calling API.

### Child pattern

```typescript
export async function createChild(payload: ChildInsert & { parent_id: string }): Promise<Child> {
  const { data: parent, error: parentErr } = await supabase
    .from('parents')
    .select('organization_id')
    .eq('id', payload.parent_id)
    .single();
  if (parentErr) throw parentErr;
  if (!parent?.organization_id) throw new Error('Parent has no organization_id');

  const { data, error } = await supabase
    .from('children')
    .insert({ ...payload, organization_id: parent.organization_id })
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

## Error handling contract

| Condition | Behaviour |
|-----------|-----------|
| Insert returns error (incl. 42501) | **Throw** to caller; mutation `onError` / UI toast |
| Parent org missing | Throw before insert; message: `'Parent has no organization_id'` or domain-specific |
| No active organization (top-level) | Throw before insert; message: `'No organization selected'` |
| Swallowing errors | **Forbidden** on paths fixed in this feature |

## Edge function contract: `invoice_payments`

**File**: `supabase/functions/stripe-webhook/index.ts`

```typescript
async function insertInvoicePaymentOnce(
  supabase: SupabaseClient,
  opts: {
    invoice_id: string;
    user_id: string | null;
    organization_id: string;  // REQUIRED — from invoice row or urlOrganizationId
    stripe_invoice_id: string;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    amount: number;
    status: string;
  },
): Promise<void>
```

Callers MUST pass `organization_id` from:
- `row.organization_id` / `existing.organization_id` after invoice load, OR
- `ctx.urlOrganizationId` when invoice row org matches URL org (post ownership check)

Idempotent duplicate (`23505`) may still be ignored silently.

## Tables covered

`cemeteries`, `companies`, `inbox_conversations`, `inbox_messages`, `inscriptions`, `invoices`, `payments`, `permit_forms`, `products`, `table_view_presets`, `invoice_payments`

## Explicit non-goals

- No changes to RLS policy definitions
- No new columns or migrations
- No changes to `public.user_is_member_of_org`
