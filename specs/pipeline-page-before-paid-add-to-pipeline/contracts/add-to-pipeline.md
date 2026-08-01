# Contract: Add-to-pipeline intake flow (inbox)

One mutation, `useAddToPipeline()`, in `src/modules/jobsPipeline/` (exported via the module's
`index.ts`; the inbox imports it from `@/modules/jobsPipeline` — public surface, no deep import).
Button lives in the inbox `ConversationHeader` secondary action slot, wired from
`ConversationView`, visible only when `fetchConversationJob(conversationId)` resolved to null.

## Input

```ts
{
  conversation: {
    id: string;
    organization_id: string;      // present on the DB row; TS interface omits it — pass explicitly
    channel: string;              // 'email' | 'sms' | 'whatsapp' | 'web'
    primary_handle: string;
    person_id: string | null;
    link_state: string;
  }
}
```

## Steps (sequential; each step's failure aborts the rest)

1. **Concurrency re-check** — `fetchConversationJob(conversation.id)`; if a job exists, abort
   with an informational toast ("Already in pipeline") and invalidate the conversationJob key.
   Best-effort V1 (no DB uniqueness on `conversation_id`).
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

- Invalidate: `['jobsPipeline', 'conversationJob', conversation.id]`,
  `['jobsPipeline', 'active', organizationId]`, and `inboxKeys.all` (conversation list/detail
  reflect the new link) — same invalidation set precedent as `useLinkConversation`.
- Success toast with a "View pipeline" action navigating to `/dashboard/inquiries`.

## Explicit prohibitions

- Never query `people` without the org filter (FR-010 — a same-handle person in another org must
  not link or leak).
- Never write `enquiry_stage`, `updated_at`, or any conversation field beyond
  `person_id`/`link_state`/`link_meta`.
- Never create a job when one exists for the conversation (step 1 guard).
