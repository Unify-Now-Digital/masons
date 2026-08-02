# Data Model: Orders Page Default View — Customers Only

**Date**: 2026-08-03 | **Plan**: [plan.md](./plan.md)

No schema changes. This documents the read shapes and derived values only.

## Existing tables (read-only for this feature)

### orders
- `id` uuid PK, `organization_id` uuid (tenant scope), `job_id` uuid NULL → jobs.id,
  `person_id` uuid NULL → people.id, `is_test` boolean, plus existing business columns.
- No stage column exists and none is added (FR-001).

### jobs (source: `supabase/migrations/20260801210000_jobs_pipeline_schema.sql`)
- `id` uuid PK, `organization_id` uuid (tenant scope)
- `stage` text CHECK IN ('enquired','quoted','invoiced','confirmed','in_production','fixed','complete')
- `paid_at` timestamptz NULL — may be set manually; drives the paid indicator
- `exit_reason` text NULL ('lost','closed','dormant','on_hold','cancelled') — separate axis; never
  affects grouping (FR-002)

### people
- `is_customer` boolean — **deprecated as the Orders-page Client badge source** by this feature;
  field and other consumers untouched.

## Read shape changes (TypeScript)

### `Order` (src/modules/orders/types/orders.types.ts) — added embed

```ts
/** Embedded from jobs!job_id in the list fetch; null when unlinked or join returns no row. */
job?: { stage: JobStage; paid_at: string | null; exit_reason: string | null } | null;
```

`JobStage` imported type-only from `@/modules/jobsPipeline` (new public-surface export; defined in
`src/modules/jobsPipeline/types/jobsPipeline.types.ts`).

### `UIOrder` (src/modules/orders/utils/orderTransform.ts) — added derived fields

```ts
/** Derived once from the embedded job; consumed by BOTH the tab filter and the Client badge. */
group: OrderGroup;                 // 'customers' | 'enquiries' | 'unassigned'
jobStage: JobStage | null;
jobPaidAt: string | null;
```

`person?: { is_customer: boolean }` remains on both types (other consumers) but the Client badge
stops reading it.

## Derived grouping (src/modules/orders/utils/orderGrouping.ts — NEW)

| Condition (embedded `job`)                                            | group        | Tab        |
|-----------------------------------------------------------------------|--------------|------------|
| `null` (job_id NULL, orphaned ref, or RLS-filtered)                   | `unassigned` | Unassigned |
| `stage ∈ {enquired, quoted}`                                          | `enquiries`  | Enquiries  |
| `stage ∈ {invoiced, confirmed, in_production, fixed, complete}`       | `customers`  | Customers  |

- **All** tab = no group filter (every org order).
- Invariant: the three groups partition the org's orders; All is their union (SC-002).
- `exit_reason` and `paid_at` are carried but never consulted by `getOrderGroup`.
- Client badge: `group === 'customers'` → "Customer" (green); `'enquiries'` → "Enquiry";
  `'unassigned'` → "Unassigned" (grey). Paid pill: `jobPaidAt !== null`.

## Fixture (Sears Melvin, verified 2026-08-03)

| Tab        | Expected                                                                 |
|------------|--------------------------------------------------------------------------|
| Customers  | 6 — Barnett, Marshall, Henry, Campbell (confirmed, paid); Dean, Jalloh (invoiced, unpaid) |
| Unassigned | 4 real rows (7 total minus 3 `is_test`, hidden by default test-data mode) |
| All        | Customers + Enquiries + Unassigned counts                                 |
