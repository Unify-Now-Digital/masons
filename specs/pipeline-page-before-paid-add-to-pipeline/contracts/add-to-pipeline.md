# Contract: Add-to-pipeline intake flow (inbox)

> REVISED 02 Aug (Giorgi): multiple jobs per person/conversation are supported (repeat
> customers). The button never permanently disappears; when jobs already exist it relabels to
> "New job" and intentionally creates an additional job. Original single-job wording below is
> updated accordingly.

One mutation, `useAddToPipeline()`, in `src/modules/jobsPipeline/` (exported via the module's
`index.ts`; the inbox imports it from `@/modules/jobsPipeline` — public surface, no deep import).
The button lives in a dedicated `pipelineAction` slot on `ConversationHeader` (the secondary and
tertiary slots were already taken in the grouped view), wired from BOTH views:

- **Flat `ConversationView`** — single-conversation probe (`useConversationJob`): no job →
  "Add to pipeline"; job exists → "New job" (`allowAdditional: true`). Hidden only while the
  probe is unresolved.
- **Grouped `CustomerConversationView`** — group probe (`useConversationsJobs`) over ALL of the
  selected row's `conversationIds` (threaded down from `UnifiedInboxPage`'s
  `selectedCustomersRow`): no jobs → "Add to pipeline"; ≥1 job → "New job". Target of either
  action is the group's most recent conversation (`latestConversationId`). A hint chip
  "In pipeline: <stage>" shows the most recent ACTIVE job's stage (exit_reason and paid_at both
  null) as a duplicate-prevention nudge; omitted when all jobs are exited/paid.

## Input

```ts
{
  conversationId: string;
  allowAdditional?: boolean;   // true = intentional extra job; skips the step-1 guard
}
```

The mutation resolves the conversation row itself — `select id, channel, primary_handle,
person_id from inbox_conversations` scoped `.eq('organization_id', …)` — so callers never
assemble conversation fields (the `InboxConversation` TS type omits `organization_id` anyway;
the hook takes the org from `useOrganization()`).

## Steps (sequential; each step's failure aborts the rest)

1. **Concurrency re-check** (skipped when `allowAdditional`) — `fetchConversationJob(id)`; if a
   job exists, abort with an informational toast ("Already in pipeline") and invalidate.
   Guards accidental duplicates only — an explicit "New job" bypasses it. Best-effort V1 (no DB
   uniqueness on `conversation_id`).
2. **Resolve person**:
   - `conversation.person_id` set → use it, skip to step 3.
   - Else classify `primary_handle`: contains `@` → email (trim+lowercase); else digits-only
     ≥7 → phone (match last 10); else unclassified.
   - Dedupe **org-scoped only**: fetch `people` `id, first_name, last_name, email, phone` with
     `.eq('organization_id', conversation.organization_id)`; match by normalized email equality
     or phone-last-10 equality (same matchers as `AddToCustomersDialog.tsx:46-48,133-143`).
     Match → reuse that `person.id`.
   - No match → insert person:
     `{ organization_id, first_name: emailLocalPart | rawHandle, last_name: '', email?, phone? }`.
     (`last_name` NOT NULL → empty string; display sites all fall back to email/phone/handle.)
3. **Create job** — insert:
   `{ organization_id, person_id, conversation_id: conversation.id, source: mapChannelToSource(channel), stage: 'enquired', stage_status: 'uncontacted' }`.
   `mapChannelToSource`: `email→email`, `whatsapp→whatsapp`, `ghl→ghl`, `web→website`
   (web-channel conversations are trigger-created website enquiries), `sms→sms`
   (`jobs_source_check` extended in production 02 Aug to include `'sms'`), anything
   unrecognized → `manual`.
4. **Link conversation** (only if `person_id` was null at entry) — update:
   `{ person_id, link_state: 'linked', link_meta: {} }` scoped
   `.eq('id', conversation.id).eq('organization_id', organization_id)`.
   **MUST NOT include `updated_at`** (PostgREST silent-reject; incident precedent commit
   `53e8eb1`). Mirrors `linkConversation` (`inboxConversations.api.ts:184-203`).

## Failure semantics (partial-progress is acceptable, V1)

- Step 2 person created but step 3 fails → person row remains (harmless; org-scoped, reusable by
  the retry's dedupe). Error toast; nothing rolled back.
- Step 3 succeeded but step 4 fails → job exists and is functional; conversation remains
  unlinked; retry path is the existing "Link person" action. Error toast states the partial
  outcome.
- No transactional RPC in V1 (would need a new DB function — schema-adjacent work excluded from
  this feature). Logged as a possible hardening follow-up.

## On success

- Invalidate at the roots: `['jobsPipeline']` (covers the active board and both conversation-job
  probes, single and group) and `['inbox']` (`inboxKeys.all` is not exported from the inbox
  barrel — literal root key).
- Success toast — "Added to pipeline" (first job) or "New job created" (`allowAdditional`) —
  with a "View pipeline" action navigating to `/dashboard/inquiries`.

## Explicit prohibitions

- Never query `people` without the org filter (FR-010 — a same-handle person in another org must
  not link or leak).
- Never write `enquiry_stage`, `updated_at`, or any conversation field beyond
  `person_id`/`link_state`/`link_meta`.
- Never create a job *accidentally* when one exists (step 1 guard); additional jobs are created
  only through the explicit "New job" action (`allowAdditional: true`).
