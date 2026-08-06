# Data Model: Pipeline After-Payment Tab

**Date**: 2026-08-06 | **Plan**: [plan.md](plan.md)

No schema changes. Everything below is the existing `jobs` model
(`supabase/migrations/20260801210000_jobs_pipeline_schema.sql`) plus new frontend-only
constants/types in `src/modules/jobsPipeline/types/jobsPipeline.types.ts`.

## `jobs` — fields in play

| Field | Type | Role in this feature |
|---|---|---|
| `id` | uuid | Card identity, mutation target |
| `organization_id` | uuid | Tenancy — every query filters on it (+ RLS) |
| `stage` | text, CHECK ∈ 7 values | **Sole membership gate** for the after-paid board |
| `paid_at` | timestamptz, null | Displayed data / warning trigger — **never routes** the after board |
| `exit_reason` | text, null, CHECK | Non-null ⇒ Exited view, excluded from both boards |
| `exited_at` | timestamptz | Paired CHECK: set iff `exit_reason` set |
| `wake_at` | timestamptz | Paired CHECK: required iff `exit_reason = 'dormant'` |
| `stage_status` | text, null | Existing card pill, rendered as-is |
| `person` / `conversation` | embeds | Existing card display (`JOB_SELECT` unchanged) |

## Stage axes (frontend constants)

```ts
// existing — UNTOUCHED
export const BEFORE_PAID_STAGES = ['enquired', 'quoted', 'invoiced'] as const;
export type BeforePaidStage = (typeof BEFORE_PAID_STAGES)[number];

// new — sibling, same file
export const AFTER_PAID_STAGES = ['confirmed', 'in_production', 'fixed', 'complete'] as const;
export type AfterPaidStage = (typeof AFTER_PAID_STAGES)[number];

// new — post-paid exit reasons (mirror of existing PrePaidExitReason)
export type PostPaidExitReason = 'on_hold' | 'cancelled';
```

The two arrays partition the seven-value `JobStage` vocabulary. Each is **ordered** — array
index defines column order and move adjacency within its axis. They are separate axes, not
one list: adjacency is only defined *within* an axis (research D4).

## View membership (org-scoped, exhaustive)

| View | Gate | Notes |
|---|---|---|
| Before-paid board | `exit_reason IS NULL AND paid_at IS NULL`, rendered stages ∩ `BEFORE_PAID_STAGES` | Existing, unchanged (see plan OD-1 for the known `invoiced`+paid gap) |
| **After-paid board** | `exit_reason IS NULL AND stage IN AFTER_PAID_STAGES` | New. No `paid_at` predicate |
| Exited view | `exit_reason IS NOT NULL` | Existing, unchanged |

**Invariants**:
1. No job satisfies more than one gate above ⇒ no job renders on two views.
2. Every row the after-paid query returns is rendered — grouping keys off the same
   `AFTER_PAID_STAGES` list the query filters on, so nothing fetched can be dropped
   (FR-005 / Task A precedent).
3. `paid_at IS NULL` on an after-paid row ⇒ rendered **with** the "Not marked paid"
   warning, never hidden. (Zero such rows live as of 06 Aug.)

## State transitions this feature performs

| Transition | Mechanism | Validation |
|---|---|---|
| `confirmed ⇄ in_production ⇄ fixed ⇄ complete` | `moveJobStage` (existing UPDATE of `stage`) | Same-axis + adjacent (index distance 1) |
| `invoiced ↛ confirmed`, `confirmed ↛ invoiced` | — | **Rejected both directions**: axes differ (research D4). Entering `confirmed` remains a payment-flow concern, out of scope |
| After-paid job → exited | `exitJob` with `on_hold` \| `cancelled` | Sets `exit_reason` + `exited_at`; `wake_at` stays null (dormant not offered post-paid) |
| Exited (post-paid stage) → board | existing `reopenJob` | Clears exit fields; job reappears on the **after** board by its stored stage — requires `afterPaid` cache invalidation |

## Query keys (additive)

```ts
afterPaid: (organizationId) => ['jobsPipeline', 'afterPaid', organizationId]
```

Invalidation matrix (hooks in `useJobMutations.ts`):

| Mutation | Invalidates |
|---|---|
| `useMoveJobStage` | `active` (existing) **+ `afterPaid`** |
| `useExitJob` | `active`, `exited`, `dueDormantCount` (existing) **+ `afterPaid`** |
| `useReopenJob` | `active`, `exited`, `dueDormantCount` (existing) **+ `afterPaid`** |

`invoiceSummaries` is shared by both boards under its existing key — one cache entry, no
duplicate fetch (research D1/D6).
