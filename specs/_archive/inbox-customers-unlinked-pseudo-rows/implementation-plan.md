# Implementation plan: Unlinked pseudo-customers in Inbox Customers tab

**Branch (recommended):** `feature/inbox-customers-unlinked`  
**Repo root:** `c:/Users/owner/Desktop/unify-memorial-mason-main`  
**Source of truth:** Prior `/specify` analysis (conversation in thread) + approved behavior list below.  
**Note:** `.specify/scripts/bash/setup-plan.sh` is **not present** in this repository; artifacts are stored under `specs/inbox-customers-unlinked-pseudo-rows/`.

## Approved behavior (summary)

- Customers tab shows **linked** rows (grouped by `person_id`) and **unlinked** pseudo-rows (grouped by exact `primary_handle` per channel).
- Unlinked title = handle; **Unlinked** badge; middle pane = messages only for conversations matching **exact** handle + channel + `person_id IS NULL`.
- Linked behavior unchanged; link/unlink migrates rows naturally via data.
- Search, filters, sort, AI summary work for both; **orders panel** only for linked (`personId` non-null selection).

---

## 1. Type and selection model

### 1.1 Row union (discriminated)

Extend or replace `CustomerThreadRow` in `src/modules/inbox/types/inbox.types.ts`:

```ts
// Conceptual — exact names TBD in implementation
export type CustomerThreadRow =
  | {
      kind: 'linked';
      personId: string;
      displayName: string;
      latestMessageAt: string | null;
      latestPreview: string | null;
      unreadCount: number;
      hasUnread: boolean;
      channels: InboxChannel[];
      latestConversationIdByChannel: ConversationIdByChannel;
      conversationIds: string[];
    }
  | {
      kind: 'unlinked';
      channel: InboxChannel;
      handle: string; // exact inbox_conversations.primary_handle
      displayTitle: string; // === handle (explicit field for clarity in UI)
      latestMessageAt: string | null;
      latestPreview: string | null;
      unreadCount: number;
      hasUnread: boolean;
      channels: [InboxChannel]; // single channel for pseudo-row
      latestConversationIdByChannel: ConversationIdByChannel; // only that channel populated
      conversationIds: string[];
    };
```

**Grouping key for unlinked:** `` `${channel}\u0000${primary_handle}` `` (or tuple in code) — **no** normalization beyond what exists in DB; document that inconsistent formatting (`+44` vs `0044`) yields separate rows (acceptable per “exact”).

### 1.2 Selection model (replace `selectedPersonId`)

**Option A (recommended):** discriminated union in React state:

```ts
type CustomersSelection =
  | { type: 'linked'; personId: string }
  | { type: 'unlinked'; channel: InboxChannel; handle: string };
```

**Option B:** single string token (simpler props):

- Linked: `person:<uuid>`
- Unlinked: `unlinked:<channel>:<base64url(primary_handle)>` or `unlinked:<channel>:<encodeURIComponent(handle)>`

Use **encodeURIComponent** for handle in token; parse on read. UUID regex distinguishes `person:` branch.

**Recommendation:** keep **Option A** internally in `UnifiedInboxPage`; expose narrow props to children (`personId` | null + `unlinkedTarget` | null) to avoid encoding bugs in deep trees.

### 1.3 Stable list key

- Linked: `linked:${personId}`
- Unlinked: `unlinked:${channel}:${handle}` — for React `key`, prefer same as grouping key or the encoded selection token.

---

## 2. Left-list plan (`useCustomerThreads.ts`)

**File:** `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/hooks/useCustomerThreads.ts`

### 2.1 Data source

- Keep `useConversationsList(baseFilters)` + `useCustomersList()` as today.
- **Remove** early return `if (!conversation.person_id) return` when building groups.
- **Split** conversations into:
  - **Linked:** `person_id != null`
  - **Unlinked:** `person_id == null` (and optionally `link_state !== 'linked'` if you must exclude ambiguous edge cases — align with Conversations tab `showUnlinked` logic in `InboxConversationList.tsx`; default: **null `person_id` only**).

### 2.2 Linked grouping (unchanged logic)

- `Map<personId, InboxConversation[]>` → existing reduction for `latestMessageAt`, `latestConversationIdByChannel`, unread sums, channel set.

### 2.3 Unlinked grouping

- `Map<string, InboxConversation[]>` keyed by `` `${c.channel}\u0000${c.primary_handle}` `` (exact string from row).
- For each group: same aggregates as linked (latest by `last_message_at` / `created_at`, sum `unread_count`, channel list = **one** channel).

### 2.4 Filters

| Filter | Linked rows | Unlinked rows |
|--------|-------------|---------------|
| **All** | include | include |
| **Unread** | `unreadCount > 0` | same |
| **Urgent** | any conversation in group matches `isUrgent(conv)` (existing helper) | same |
| **Unlinked** | **exclude** | **include only** |
| **Channel (dropdown)** | include if group has that channel | include if `group.channel === filter` |

**Remove** current line that does `if (listFilter === 'unlinked') return` inside linked-only builder (today it empty-lists linked when Unlinked — wrong). New semantics: **Unlinked** = show **only** pseudo-rows.

### 2.5 Sort

- Merge `CustomerThreadRow[]` (both kinds) → single array.
- Sort by `latestMessageAt` desc (nulls last), tie-breaker: `kind` then `personId` or `handle` string compare for stability.

### 2.6 Search

- Rely on `baseFilters.search` already applied to conversation fetch (`inboxConversations.api.ts` ILIKE on `primary_handle`, subject, preview). No extra client filter required unless product wants row-title-only search — then filter merged rows by `displayName` / `displayTitle` / preview.

---

## 3. Middle-pane plan

### 3.1 `UnifiedInboxPage.tsx`

**File:** `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/pages/UnifiedInboxPage.tsx`

- Replace `selectedPersonId` with `customersSelection` (discriminated) or derive `selectedPersonId` **only** for linked + pass `unlinkedTarget` separately.
- **`activePersonId`:** `customersSelection?.type === 'linked' ? customersSelection.personId : null` so **`PersonOrdersPanel`** never receives a pseudo-id (req: orders linked-only).
- **Auto-read (customers):** extend effect to resolve `conversationIds` from selected row (linked or unlinked) from `customerRows` by selection match.
- **Mark read/unread:** `handleToggleReadUnread` already uses `customerRows.find(...)` — switch finder to selection discriminator.
- **`CustomerThreadList`:** pass `selection` + `onSelectLinked(personId)` / `onSelectUnlinked(channel, handle)` or a single callback with union.
- **`toggleReadUnreadDisabled`:** false when either linked person or unlinked group selected and has ids.
- **`selectedHasUnread`:** resolve from row matching current selection.

### 3.2 `CustomerConversationView.tsx`

**File:** `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/components/CustomerConversationView.tsx`

**Props (conceptual):**

```ts
interface Props {
  linkedPersonId: string | null;
  unlinked: { channel: InboxChannel; handle: string } | null;
}
// invariant: exactly one non-null when showing a thread, or both null for empty state
```

**Linked path (unchanged):** current behavior when `linkedPersonId` set.

**Unlinked path:**

- **Header:** `displayName` = `unlinked.handle`; `linkStateLabel` = `"Unlinked"`; `handleLine` = channel label only (e.g. `Email` / `SMS` / `WhatsApp`).
- **Summary:** `useThreadSummary({ scope: 'unlinked_timeline', channel, handle })` (new).
- **Timeline:** `useUnlinkedHandleTimeline({ channel, handle })` (new hook).
- **Skip** `useCustomer` when unlinked.

**`autoScrollResetKey`:** use `linkedPersonId ?? \`unlinked:${channel}:${handle}\``.

### 3.3 Orders panel

- No change to `PersonOrdersPanel` if `personId={activePersonId}` and `activePersonId` is **null** for unlinked — verify panel shows empty/placeholder for null (add guard if it assumes UUID).

---

## 4. Messages / timeline data plan

### 4.1 Hook

**File:** `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/hooks/useInboxMessages.ts`

Add **`useUnlinkedHandleTimeline({ channel, handle }: { channel: InboxChannel; handle: string } | null)`**:

1. `enabled: !!channel && handle.length > 0`
2. Fetch conversations: prefer **narrow API** (see 4.2) with `status: 'open'`, `person_id: null`, `channel`, `primary_handle` **exact** `.eq()`.
3. `conversationIds` sorted → `fetchMessagesByConversationIds` (reuse).
4. Reuse same chronological merge as `usePersonUnifiedTimeline` (dedupe by id + sort).

**Query key:** e.g. `inboxKeys.messages.unlinkedTimeline(channel, handle)` — add to `inboxKeys` in `useInboxConversations.ts`.

### 4.2 `fetchConversations` extension

**File:** `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/api/inboxConversations.api.ts`  
**Types:** `src/modules/inbox/types/inbox.types.ts` — extend `ConversationFilters`:

- `person_id_is_null?: boolean` — when true, `.is('person_id', null)` (avoid coupling with `unlinked_only` if that combines with other semantics).
- Or overload: `primary_handle_exact?: string` + `channel` + `person_id_is_null`.

**Why:** Scales when conversation list is large; middle pane should not depend on full list cache.

**Invalidation:** existing `invalidateQueries({ queryKey: inboxKeys.all })` on link/send already covers; add **explicit** invalidation for `unlinkedTimeline` when linking a conversation that matched a handle (same as `inboxKeys.all` fan-out — verify).

---

## 5. AI summary plan

### 5.1 Client — `useThreadSummary.ts`

**File:** `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/hooks/useThreadSummary.ts`

- Extend `ThreadSummaryScope`:

```ts
| { scope: 'unlinked_timeline'; channel: InboxChannel; handle: string | null }
```

- `fetchThreadSummary` POST body: `{ scope: 'unlinked_timeline', channel, handle }`.
- `enabled`: non-null handle, valid channel.
- Query key: `[...INBOX_THREAD_SUMMARY_QUERY_KEY, 'unlinked_timeline', channel, handle]`.
- `invalidateInboxThreadSummaries` — no signature change; prefix invalidation already clears all summary queries.

### 5.2 Edge function — `inbox-ai-thread-summary/index.ts`

**File:** `c:/Users/owner/Desktop/unify-memorial-mason-main/supabase/functions/inbox-ai-thread-summary/index.ts`

- Accept `scope === 'unlinked_timeline'` + `channel` + `handle` (non-empty).
- Load conversations: `user_id` must match authenticated user (use same auth pattern as today; service role queries with filter `user_id = auth.uid()` from JWT — mirror `conversation` scope ownership checks).
- Filter: `status = 'open'`, `person_id IS NULL`, `channel = ?`, `primary_handle = ?` (exact).
- Load messages: `.in('conversation_id', ids)` + same sort/fingerprint/OpenAI flow as `customer_timeline`.
- **Empty list:** delete cache row for this unlinked key; return `{ summary: null }`.

### 5.3 DB migration — `inbox_ai_thread_summaries`

**New migration file:** e.g. `c:/Users/owner/Desktop/unify-memorial-mason-main/supabase/migrations/YYYYMMDDHHMMSS_inbox_ai_summaries_unlinked_scope.sql`

**Problem:** Unlinked identity is not globally unique; summaries table has no `user_id` today — **add `user_id uuid references auth.users(id) on delete cascade` nullable for backfill**, then **NOT NULL** for new scope rows (or enforce in app only — prefer DB NOT NULL for new inserts).

**Add columns (example):**

- `user_id uuid` (nullable initially; backfill from join on existing rows via `person_id` → customers or conversations — **minimal path:** allow NULL for old rows; **require** for `unlinked_timeline` only via CHECK).

**New scope:** `unlinked_timeline` in CHECK constraint:

- `scope = 'unlinked_timeline'` ⇒ `person_id IS NULL`, `conversation_id IS NULL`, `unlinked_channel text NOT NULL`, `unlinked_handle text NOT NULL`, `user_id NOT NULL`.

**Unique index:** `(user_id, scope, unlinked_channel, unlinked_handle)` WHERE `scope = 'unlinked_timeline'`.

**RLS:** SELECT policy — exists `inbox_conversations` where `user_id = auth.uid()`, `person_id` null, matching channel/handle, `status = 'open'`.

**Customer timeline RLS** today uses `person_id` — extend or add parallel policy for unlinked scope.

### 5.4 Uniqueness / `user_id`

**Yes — add `user_id` on summary rows for unlinked scope** (and set it on insert in edge function from JWT). Otherwise two users could collide on same handle in a shared-DB test or mis-scoped unique index.

---

## 6. Link / unlink lifecycle

- **Link:** `linkConversation` sets `person_id` on one conversation → that conversation leaves unlinked groups on next fetch; appears under linked customer. **Invalidation** refreshes lists + timeline + summaries.
- **Multiple conversations, same handle:** single pseudo-row with **merged** `conversationIds` (same as linked multi-channel aggregation). Linking **one** conversation: only that id moves; pseudo-row may remain if others still unlinked with same handle — document in UI/tooltip (no bulk link in v1 unless specified).
- **Unlink:** conversation returns to `person_id null` → reappears in unlinked group after refresh.

---

## 7. Rollout order (minimize breakage)

1. **Types** — `CustomerThreadRow` union + `ConversationFilters` + `inboxKeys.messages.unlinkedTimeline`.
2. **API** — `fetchConversations` narrow filters (optional but do before hook if you want hook to use API from day one).
3. **Hook** — `useUnlinkedHandleTimeline` + wire **no UI** (smoke via temporary dev).
4. **`useCustomerThreads`** — build merged rows; fix Unlinked filter semantics; keep `CustomerThreadList` on old shape **briefly** behind adapter if needed — prefer **single step** update list component.
5. **`CustomerThreadList`** — render union + badge + callbacks.
6. **`UnifiedInboxPage` selection** — discriminated state + orders null + read/unread.
7. **`CustomerConversationView`** — branch unlinked header + timeline hook.
8. **DB migration** — `inbox_ai_thread_summaries` + RLS.
9. **Edge function** — unlinked scope.
10. **Client `useThreadSummary`** — unlinked scope.
11. **E2E manual:** search, filters, link, summary cache invalidation.

---

## 8. Risks / guardrails

| Risk | Mitigation |
|------|------------|
| Selection collision | Never use raw handle as sole id; use discriminated union + encoded key. |
| Invalidation gaps | On link/unlink, keep `invalidateQueries(inboxKeys.all)` + `invalidateInboxThreadSummaries`; add `unlinkedTimeline` key family under `inboxKeys.messages` so targeted invalidation possible. |
| AI cache key mistakes | Query key + DB unique include `user_id`, `channel`, **exact** `handle`; normalize only if product agrees (else exact DB string). |
| Handle exact-match | Same email with different casing in DB → two rows; document; optional future normalization at **ingestion** only. |
| Performance | Narrow `fetchConversations` for middle pane; left list still one list query — acceptable; cap consider later. |
| `limit(1000)` in duplicate checks elsewhere | Out of scope unless timeline hits same limit in new code paths — avoid copying that pattern into new hooks. |

---

## 9. File-by-file checklist

| File | Action | Why |
|------|--------|-----|
| `src/modules/inbox/types/inbox.types.ts` | Modify | Row union; optional `ConversationFilters` fields. |
| `src/modules/inbox/hooks/useInboxConversations.ts` | Modify | `inboxKeys.messages.unlinkedTimeline` helper. |
| `src/modules/inbox/hooks/useCustomerThreads.ts` | Modify | Unlinked grouping + merge + filter fixes. |
| `src/modules/inbox/components/CustomerThreadList.tsx` | Modify | Render both kinds, badge, selection props, keys. |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Modify | Selection model, `activePersonId`, handlers, props wiring. |
| `src/modules/inbox/components/CustomerConversationView.tsx` | Modify | Unlinked branch, header, hooks. |
| `src/modules/inbox/hooks/useInboxMessages.ts` | Modify | `useUnlinkedHandleTimeline`. |
| `src/modules/inbox/api/inboxConversations.api.ts` | Modify | Narrow filters for open + null person + handle. |
| `src/modules/inbox/hooks/useThreadSummary.ts` | Modify | New scope + fetch body + query key. |
| `supabase/functions/inbox-ai-thread-summary/index.ts` | Modify | `unlinked_timeline` branch + cache read/write. |
| `supabase/migrations/*.sql` | **New** | Schema + RLS for unlinked summaries + `user_id`. |
| `src/shared/types/database.types.ts` | Modify | Regenerate or hand-update if used for summaries typing. |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` | Modify only if needed | Null `personId` guard / empty state. |

**New files:** optional `src/modules/inbox/utils/customersSelection.ts` for encode/decode if using string tokens — only if not keeping union only in page state.

---

## Progress tracking (template)

| Phase | Artifact | Status |
|-------|----------|--------|
| 0 Research | `research.md` | Complete (see companion file) |
| 1 Design | `data-model.md`, `contracts/`, `quickstart.md` | Complete (see companion files) |
| 2 Tasks | `tasks.md` | Complete (see companion file) |

---

## Constitution

**File referenced by command:** `c:/Users/owner/Desktop/unify-memorial-mason-main/.specify/memory/constitution.md` — **not present** in repo. Align with existing project docs: `AGENTS.md` (trust, no broad refactors), `CLAUDE.md` (Supabase/React patterns), RLS on new SQL.
