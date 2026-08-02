# Contract: Orders list fetch + grouping

**Date**: 2026-08-03 | **Plan**: [../plan.md](../plan.md)

## Query contract — `fetchOrders(organizationId, { excludeTest })`

`src/modules/orders/api/orders.api.ts`

**Select string** (only the `job:` embed is new):

```
*, order_additional_options(cost), quote:quotes!quote_id(product_name),
person:people!person_id(is_customer), job:jobs!job_id(stage, paid_at, exit_reason)
```

**Guarantees**:
1. Outer query stays `.eq('organization_id', organizationId)`; `excludeTest` behavior unchanged.
2. Left embed: orders with `job_id IS NULL`, a dangling `job_id`, or an RLS-invisible job all
   return `job: null`. No order row is ever dropped by the embed (no `!inner`).
3. `job.stage` is one of the seven CHECK-constrained values whenever `job` is non-null.
4. `job.paid_at` / `job.exit_reason` are nullable pass-throughs; no client normalization.
5. Return type: existing normalized `Order[]` plus `job` field; `normalizeOrder` must pass the
   embedded object through untouched.

## Grouping contract — `getOrderGroup(job)`

`src/modules/orders/utils/orderGrouping.ts` (NEW)

```ts
getOrderGroup(job: { stage: JobStage } | null | undefined): 'customers' | 'enquiries' | 'unassigned'
```

| Input                                   | Output       |
|-----------------------------------------|--------------|
| `null` / `undefined`                    | `unassigned` |
| stage `enquired` \| `quoted`            | `enquiries`  |
| stage `invoiced` \| `confirmed` \| `in_production` \| `fixed` \| `complete` | `customers` |

**Guarantees**: total (every input maps to exactly one group); pure; ignores `paid_at` and
`exit_reason`; the ONLY grouping authority — both the tab filter (`OrdersPage.tsx`) and the Client
badge (`orderColumnDefinitions.tsx`) must call through it (directly or via `UIOrder.group`).

## Tab filter contract — `OrdersPage.tsx`

| Tab value    | Predicate over `UIOrder`        |
|--------------|---------------------------------|
| `customers`  | `group === 'customers'` (DEFAULT) |
| `enquiries`  | `group === 'enquiries'`         |
| `all`        | always true                     |
| `unassigned` | `group === 'unassigned'`        |

Composes with existing search and cemetery filters unchanged (AND semantics preserved).

## Badge/indicator contract — `orderColumnDefinitions.tsx` (`customerType` column)

- Column `id`/`label`/`defaultWidth`/position: UNCHANGED.
- Badge text/variant from `UIOrder.group` (never `person.is_customer` — deprecated here).
- Paid pill rendered iff `UIOrder.jobPaidAt !== null`.
