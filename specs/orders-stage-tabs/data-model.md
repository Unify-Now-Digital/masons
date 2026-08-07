# Data Model: Orders Page Tabs Aligned with Pipeline Stages

**No database changes.** All changes are TypeScript types and derived UI state inside
`src/modules/orders/`. The DB shape consumed is the existing list-fetch embed
`job:jobs!job_id(stage, paid_at, exit_reason)` (`orders.api.ts:30`, typed at
`orders.types.ts:111`).

## Type changes

### `OrderGroup` (orderGrouping.ts) — widened

```ts
// before
export type OrderGroup = 'customers' | 'enquiries' | 'unassigned';
// after
export type OrderGroup = JobStage | 'unassigned';
```

`JobStage` (public export of `@/modules/jobsPipeline`) =
`'enquired' | 'quoted' | 'invoiced' | 'confirmed' | 'in_production' | 'fixed' | 'complete'`.

### `OrdersTab` (orderGrouping.ts) — new

```ts
export type OrdersTab = OrderGroup | 'all';
```

Must be the declared type of `OrdersPage`'s tab state and tab-config array — this typing is
what turns stale `'customers'`/`'enquiries'` literals into compile errors (plan R3).

### `UIOrder` (orderTransform.ts) — one field added

```ts
group: OrderGroup;              // unchanged declaration; meaning widens with the alias
jobExitReason: string | null;   // NEW — from order.job?.exit_reason ?? null
```

`jobStage`/`jobPaidAt` unchanged. `person` stays deprecated for the badge.

## Vocabulary (exported stage sets in orderGrouping.ts)

Two intentional partitions of the seven-stage vocabulary coexist:

| Set | Members | Consumer |
|---|---|---|
| `ENQUIRY_STAGES` (existing) | enquired, quoted | Client badge: "Enquiry" |
| `CUSTOMER_STAGES` (existing) | invoiced, confirmed, in_production, fixed, complete | Client badge: "Customer"/"Invoiced" |
| `ORDERS_BEFORE_PAYMENT_TABS` (new) | enquired, quoted, invoiced | tab strip section "Before payment" |
| `ORDERS_AFTER_PAYMENT_TABS` (new) | confirmed, in_production, fixed, complete | tab strip section "After payment" |

Note the boundaries differ deliberately: `invoiced` is a *customer* for the badge but *before
payment* for the sections. Both sets live in `orderGrouping.ts` as the single shared vocabulary
(AC-002 / FR-006); nothing re-derives membership from raw job data.

## Grouping function (authority unchanged in role, widened in range)

```ts
export function getOrderGroup(job: { stage: JobStage } | null | undefined): OrderGroup {
  if (!job) return 'unassigned';   // job_id NULL / orphaned join / RLS-filtered — unchanged
  return job.stage;
}
```

Continues to ignore `paid_at` and `exit_reason` by design (separate axes). Header comment about
the axes diverging is superseded — this feature aligns them.

## Derived UI state (OrdersPage)

- `scoped: UIOrder[]` — search + cemetery filtered list (tab-independent).
- `tabCounts: Record<OrdersTab, number>` — single `reduce` over `scoped`; all nine keys
  initialised to 0 (`all` = scoped.length by increment).
- `filteredOrders: UIOrder[]` — `activeTab === 'all' ? scoped : scoped.filter(o => o.group === activeTab)`.

Invariant (FR-009): tab membership and Client badge both derive from `order.group` /
the exported stage sets — they cannot contradict.
