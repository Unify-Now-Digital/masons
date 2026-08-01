# Data Model: Pipeline Page (Before Paid) + Add to Pipeline

No schema changes in this feature. All DB objects below already exist in production
(`20260801210000_jobs_pipeline_schema.sql`, `20260801213000_jobs_backfill_sm.sql`).

## 1) Job (source of truth: `public.jobs`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL → organizations | tenant scope; RLS `user_is_member_of_org` |
| `person_id` | uuid → people | nullable; set by intake/backfill |
| `conversation_id` | uuid → inbox_conversations | nullable; card click + handle fallback resolve through this |
| `enquiry_id` | uuid → enquiries | nullable; website intake linkage (read-only here) |
| `source` | text NOT NULL | check: `website · email · whatsapp · ghl · manual · sms` (`sms` added to `jobs_source_check` in production, 02 Aug) |
| `stage` | text NOT NULL default `enquired` | check: `enquired · quoted · invoiced · confirmed · in_production · fixed · complete` |
| `stage_status` | text nullable | free text; observed values: `pending` (backfill), `uncontacted` (new intake) |
| `paid_at` | timestamptz | null for the whole Before-Paid board |
| `exit_reason` | text | check: `lost · closed · dormant · on_hold · cancelled`; UI offers first three pre-paid |
| `exited_at` | timestamptz | `jobs_exit_pairs`: null ⟺ `exit_reason` null — always written together |
| `wake_at` | timestamptz | `jobs_dormant_needs_wake`: required when `exit_reason='dormant'` |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by `trg_jobs_updated_at` — never in client payloads |

Indexes: `jobs_org_stage_idx (organization_id, stage) WHERE exit_reason IS NULL` (board);
`jobs_org_exited_idx (organization_id, exit_reason) WHERE exit_reason IS NOT NULL` (Exited view).
RLS: select/insert/update only — **no DELETE policy**.

## 2) Related entities (read/write surface in this feature)

- **`inbox_conversations`** — read: `id`, `primary_handle`, `channel`
  (`email | sms | whatsapp | web`; `web` = GHL), `person_id`, `link_state`, `organization_id`.
  Write (Add-to-pipeline only): `{ person_id, link_state: 'linked', link_meta: {} }` — never
  `updated_at` (FR-011).
- **`people`** — read (dedupe): `id, first_name, last_name, email, phone` org-scoped. Write
  (create-from-handle): `organization_id`, `first_name` (derived), `last_name` (`''` — NOT NULL),
  `email` | `phone` (from classified handle).
- **`invoices`** — read-only: `id, job_id, amount, deleted_at, status` org-scoped where
  `job_id IS NOT NULL`. `amount` = decimal GBP pounds → `formatGbpDecimal`. Never touch the
  pence fields here.
- **`orders`** — no reads or writes in this feature; `orders.job_id` is typed (FR-012) only.

## 3) Module types (`src/modules/jobsPipeline/types/jobsPipeline.types.ts`)

The Supabase client is `any`-typed, so these local types are the operative contract:

```ts
export type JobStage =
  | 'enquired' | 'quoted' | 'invoiced'
  | 'confirmed' | 'in_production' | 'fixed' | 'complete';

export const BEFORE_PAID_STAGES = ['enquired', 'quoted', 'invoiced'] as const;
export type BeforePaidStage = (typeof BEFORE_PAID_STAGES)[number];

export type JobExitReason = 'lost' | 'closed' | 'dormant' | 'on_hold' | 'cancelled';
export type PrePaidExitReason = 'lost' | 'closed' | 'dormant';   // offered by the modal

export type JobSource = 'website' | 'email' | 'whatsapp' | 'ghl' | 'manual' | 'sms';

export interface JobPersonSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export interface JobConversationSummary {
  id: string;
  primary_handle: string;
  channel: string;
}

/** Row shape returned by the board + exited queries (embedded relations). */
export interface PipelineJob {
  id: string;
  organization_id: string;
  person_id: string | null;
  conversation_id: string | null;
  enquiry_id: string | null;
  source: JobSource;
  stage: JobStage;
  stage_status: string | null;
  paid_at: string | null;
  exit_reason: JobExitReason | null;
  exited_at: string | null;
  wake_at: string | null;
  created_at: string;
  updated_at: string;
  person: JobPersonSummary | null;
  conversation: JobConversationSummary | null;
}

/** invoices reduced per job for the Invoiced gate + card total. */
export interface JobInvoiceSummary {
  count: number;          // non-deleted invoices with this job_id
  totalAmount: number;    // sum of invoices.amount (decimal GBP)
}
```

## 4) Derived rules

- **Card display name**: `[first_name, last_name].filter(Boolean).join(' ').trim() || person.email
  || person.phone || conversation.primary_handle || '—'` (matches inbox convention,
  `ConversationView.tsx:240-242`, extended with the spec's `primary_handle` fallback).
- **Column assignment**: `stage` ∈ `BEFORE_PAID_STAGES` → that column; any other stage on an
  active pre-paid row renders in no column (defensive; shouldn't occur pre-§3.3).
- **Move targets**: index ±1 within `BEFORE_PAID_STAGES`. Forward into `invoiced` requires
  `invoiceSummaryByJobId.get(job.id)?.count > 0` (UI) AND a fresh invoice re-check in the
  mutation (server-truth at write time).
- **Exit payload**: `{ exit_reason, exited_at: nowISO, wake_at: reason === 'dormant' ? wakeISO :
  null }` — satisfies `jobs_exit_pairs` + `jobs_dormant_needs_wake` atomically.
- **channel → source mapping** (Add-to-pipeline): `email→email`, `whatsapp→whatsapp`,
  `ghl→ghl`, `web→website` (trigger-created website-enquiry conversations), `sms→sms`;
  anything unrecognized → `manual`.
- **Handle classification**: contains `@` → email (normalize: trim+lowercase); else strip
  non-digits, ≥7 digits → phone (match on last 10); else unclassified (no dedupe match possible).
- **New-job payload** (Add-to-pipeline): `{ organization_id, person_id, conversation_id, source,
  stage: 'enquired', stage_status: 'uncontacted' }` — `enquiry_id` stays null (inbox intake has
  no enquiry row).

## 5) `database.types.ts` extension (FR-012 — documentation parity)

- Add `jobs` between `invoices` and `memorials` with `Row`/`Insert`/`Update`/`Relationships`.
  Relationships: `jobs_organization_id_fkey → organizations`; `jobs_person_id_fkey` × 3
  (`customer_scores`, `customers`, `people` — per file convention of one entry per view exposing
  the PK); `jobs_conversation_id_fkey → inbox_conversations`; `jobs_enquiry_id_fkey → enquiries`.
- `orders`: `job_id: string | null` in Row (between `is_test` and `latitude`), optional in
  Insert/Update; add `orders_job_id_fkey → jobs` relationship.
- `invoices`: `job_id: string | null` in Row (between `issue_date` and `locked_at`), optional in
  Insert/Update; add `invoices_job_id_fkey → jobs` relationship.
- No changes to view types (explicit-column views don't inherit columns).
