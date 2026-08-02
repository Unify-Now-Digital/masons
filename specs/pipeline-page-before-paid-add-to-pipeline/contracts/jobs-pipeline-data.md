# Contract: Pipeline board data operations

Module: `src/modules/jobsPipeline/api/` + `hooks/`. All operations require a resolved
`organizationId` from `useOrganization()`; hooks are disabled until it exists. RLS
(`jobs_org_*`) is the security boundary; the explicit `.eq('organization_id', …)` filters are
correctness/UX, not security. Query keys live in `api/jobsPipelineKeys.ts` under the
`['jobsPipeline', …]` namespace (never `['jobs', …]` — taken by the legacy module).

## Q1. fetchActiveJobs(organizationId) → PipelineJob[]

```
.from('jobs')
.select('*, person:people(id, first_name, last_name, email, phone),
         conversation:inbox_conversations(id, primary_handle, channel)')
.eq('organization_id', organizationId)
.is('exit_reason', null)
.is('paid_at', null)
.order('created_at', { ascending: false })
```

- Key: `['jobsPipeline', 'active', organizationId]`.
- Client groups rows into Enquired/Quoted/Invoiced by `stage`; stages outside
  `BEFORE_PAID_STAGES` are not rendered.
- Errors surface via the board's error state (pattern: `InquiriesBoardState`).

## Q2. fetchJobInvoiceSummaries(organizationId) → Map<jobId, JobInvoiceSummary>

```
.from('invoices')
.select('id, job_id, amount, deleted_at, status')
.eq('organization_id', organizationId)
.not('job_id', 'is', null)
```

- Key: `['jobsPipeline', 'invoiceSummaries', organizationId]`.
- Client-side reduce, skipping rows with `deleted_at` set: `count` + `totalAmount`
  (`Number(amount)` — decimal GBP pounds). Display via `formatGbpDecimal`.
- Consumed by: Invoiced-gate button state (Q1's board) and Invoiced-card totals.

## Q3. fetchExitedJobs(organizationId) → PipelineJob[]

Same select/embeds as Q1 but `.not('exit_reason', 'is', null)`, ordered `exited_at desc`.
Key: `['jobsPipeline', 'exited', organizationId]`. Reason filter is client-side (43-row scale);
uses `jobs_org_exited_idx`.

## Q4. fetchConversationJob(conversationId) → { id } | null

```
.from('jobs').select('id').eq('conversation_id', conversationId).limit(1).maybeSingle()
```

- Key: `['jobsPipeline', 'conversationJob', conversationId]`. RLS-scoped (no org filter needed;
  single-row probe mirrors `fetchConversation`'s RLS-only pattern).
- Consumed by the inbox "Add to pipeline" button visibility (button hidden while loading or when
  a job exists).

## M1. moveJobStage({ jobId, toStage })

Preconditions (enforced in the mutation, not just the button):
1. `toStage` ∈ `BEFORE_PAID_STAGES` and is exactly one step from the job's current stage.
2. If `toStage === 'invoiced'`: fresh probe
   `.from('invoices').select('id').eq('job_id', jobId).is('deleted_at', null).limit(1)` must
   return a row — otherwise reject with a user-facing "No invoice linked to this job yet" toast
   (D4 gate; guards stale cache).

Write: `.from('jobs').update({ stage: toStage }).eq('id', jobId).eq('organization_id', organizationId)`.
Payload contains `stage` only (trigger owns `updated_at`).
On success: invalidate `['jobsPipeline', 'active', organizationId]`.

## M2. exitJob({ jobId, reason, wakeAt? })

Preconditions: `reason` ∈ `'lost' | 'closed' | 'dormant'`; `wakeAt` required iff `dormant`
(modal blocks confirm otherwise — DB `jobs_dormant_needs_wake` is the backstop).

Write:
```
.update({ exit_reason: reason, exited_at: new Date().toISOString(),
          wake_at: reason === 'dormant' ? wakeAt : null })
.eq('id', jobId).eq('organization_id', organizationId)
```
Satisfies `jobs_exit_pairs` (both exit fields set together).
On success: invalidate `['jobsPipeline', 'active', …]` and `['jobsPipeline', 'exited', …]`.

## M3. reopenJob({ jobId }) *(added post-review, 02 Aug)*

Clears the exit fields: `.update({ exit_reason: null, exited_at: null, wake_at: null })`
`.eq('id', jobId).eq('organization_id', organizationId)`. Both sides of `jobs_exit_pairs` go
null together; the job returns to its stored `stage` (exiting never changed stage). UI: Reopen
button on each Exited-list row with an inline two-click confirm (armed state disarms on blur).
On success: invalidate `active` + `exited`, toast "Job reopened".

## Non-operations (by contract)

- No `.delete()` on `jobs` anywhere (no DELETE policy; no UI affordance).
- No writes to `orders` or `invoices`.
- No writes of `updated_at`, `paid_at`, `source`, `enquiry_id`, or post-paid stages from this
  module.
