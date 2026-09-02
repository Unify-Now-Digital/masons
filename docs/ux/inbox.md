# Inbox — structural audit (`/dashboard/inbox`)

2026-09-02 · Read-only static-JSX audit (Block 3 investigation, pre-spec). Line
numbers are accurate as of staging `1ab595a` and WILL drift with any edit.
Live-data reads were scoped to the two live orgs (SM, Churchill); org ids live in
`CLAUDE.local.md`. Findings from this audit are logged as F-026–F-028 and the
F-012 amendment in `docs/findings.md`.

Sources (both outside the repo, in the local plans directory):
`cc-dispatch-clever-crescent.md` (the investigation report) and
`cc-dispatch-compiled-phoenix.md` (the F-A verify). The Block 3 doc-logging
dispatch named `compiled-phoenix` for both; the investigation report actually
lives in `clever-crescent` — recorded here so the pointer mismatch doesn't
mislead a later session.

---

## A. UnifiedInboxPage structure

### A1 — Shell anatomy
The tab shell is **not in UnifiedInboxPage**. It lives in
`src/modules/inbox/components/PersonOrdersPanel.tsx` — shadcn Tabs wrapper
(`@/shared/components/ui/tabs`, PersonOrdersPanel.tsx:5) over
`@radix-ui/react-tabs ^1.1.0` (package.json:41). The wrapper is stock shadcn
(src/shared/components/ui/tabs.tsx:1-53), no local behavior.
- Shell (Tabs root, trigger list, collapse button): PersonOrdersPanel.tsx:255-307; Tabs closes :391. `SidebarTab` union :43; `PANEL_BODY_CLASSES` :47-48.
- Panels: Orders :308-377 (inline JSX); Contact :378-384; Finances :385-387; History :388-390.
- Drawers mount OUTSIDE the Tabs, at panel-component level: CreateOrderDrawer :393-401, CreateInvoiceDrawer :403-409, EditCustomerDrawer :411-415.
- UnifiedInboxPage.tsx (1400 lines) hosts the three-column grid (:1120-1393) and renders PersonOrdersPanel at :1354-1366 inside column 3 (:1350).

### A2 — Panel boundaries
A shell change is genuinely a container swap — the panels own nothing.
- **Orders**: inline JSX (:308-377) — all queries/state are PersonOrdersPanel's. Renders `OrderContextSummary` (:335), the one nested component that owns queries: `useAdditionalOptionsByOrder(order.id)` (OrderContextSummary.tsx:25), `useProductsList()` (:26).
- **InboxContactTab**: props `{hasLinkedPerson, person, onEdit}` — presentational, "no data hooks" by its own doc comment (InboxContactTab.tsx:18).
- **InboxFinancesTab**: props `{orders, isLoading}` — presentational (InboxFinancesTab.tsx:21).
- **InboxHistoryTab**: props `{jobs}` — presentational (InboxHistoryTab.tsx:22).
All queries (useOrdersByPersonId :62, useJobsByPersonId/useConversationsJobs :71-73, useCustomer :88, useConversation :89, useOrdersByJobId :100) live in PersonOrdersPanel.

### A3 — State ownership
- **UnifiedInboxPage**: view (URL `?view`), inboxSource :89, listFilter :92, customersListChannelFilter :95, searchQuery :96, selectedItems :97, selectedCustomerRowKeys :98, bulk-delete state :99-100, selectedConversationId :101-108 (seeded from `?conversation`), customersSelection :116, selectedOrderId :117, selectedJobId :120, modal/prefill state :121-129, markedReadIds :130, guard refs :132-140, leftCollapsed/rightCollapsed :147-148 — **persisted** per-user to localStorage `inbox.desktop.leftCollapsed.v1.<uid>` / `rightCollapsed` (:160-165, :199-208). Flat-view channel filter is **URL-derived** `?channel` (:253-268).
- **PersonOrdersPanel**: `activeTab` :95 (the tab state), orderDrawerOpen :93, invoiceDrawerOpen :94, editDrawerOpen :96, resolvedPersonId :85, resolvingPerson :86, summaryFlash :167, refs autoSelectedPersonRef :165 / summaryRef :166.
- **Destroyed if PersonOrdersPanel unmounts**: activeTab, all three drawer-open states plus any in-progress drawer form, resolution state, refs. Message draft is NOT here — it lives in column 2 (ConversationView/ConversationThread composer), untouched by a right-panel shell swap.
- Nothing tab-related is persisted or URL-addressable.

### A4 — Additional Options
Lives inside the **Orders tab**, as the itemized block of OrderContextSummary (:88-100 data, :130-143 render), fed by `useAdditionalOptionsByOrder(order.id)` (:25) — single-order-keyed query (`['orders','additionalOptions',orderId]`, useOrders.ts:43). The Finance tab already shows the options **total** with no fetch (row field via `getOrderAdditionalOptionsTotal(order)`, InboxFinancesTab.tsx:48,56); only the itemized lines move. Crossing the boundary: InboxFinancesTab receives `orders: Order[]` only — per-order option lines need either (a) a per-order child inside the Finance card owning its own query (the OrderContextSummary pattern, one query per order), or (b) a new batch hook. Option (a) makes the Finance card the first non-presentational panel; option (b) is new API surface. No props currently cross for this.

### A5 — Write surface
- InboxFinancesTab and Additional Options call **no writer** — display only. Invoice creation is reachable from the **Orders tab** job action (:223-231) → shared `CreateInvoiceDrawer` (post-T5-C1: no Stripe auto-create; lock discipline is the shared drawer's).
- No Stripe path in the inbox module (searched modules/inbox) — no `stripe.api.ts` / X-Admin-Token path anywhere in it. The only invoice touchpoint is a navigate to `?invoice=` (OrderContextSummary:153). Clean.

### A6 — Deep links / instrumentation
- URL params consumed: `?conversation` (seed :101-115, both views + customers deep-link resolver :587-595), `?view=flat` (useInboxView.ts:45), `?channel` (:256-268), `?gmail`/`?error` OAuth cleanup (:337-366). `/dashboard/enquiry-triage` redirect forwards `?conversation` (router.tsx:43-50); `/dashboard/ghl-inbox` redirects to inbox (router.tsx:77). **None selects a sidebar tab; no `?tab=` exists in the inbox.**
- Sentry/analytics keyed to tabs: grep 0 in modules/inbox.
- Tests: repo has exactly 3 test files (smoke + 2 invoicing utils) — none touch the tab shell. References to PersonOrdersPanel are spec docs only (specs/015-inbox-consolidation, assisted-contact-creation, inbox-sidebar-multi-tabs). The AC-002 contract comment at PersonOrdersPanel:44-46 is the in-code record of the tab behavior.
- Silent-breakage surface for a card shell: effectively nil from routing/instrumentation; the risk is the mount-preservation contract (C2), the GHL source switch (:1084-1113), and `?view=flat`'s parallel list.

---

## B. Search path

### B1 — fetchConversations
`src/modules/inbox/api/inboxConversations.api.ts:16-66`.
- Search predicate :52-55: single `.or()` string — `primary_handle.ilike.%term%,subject.ilike.%term%,last_message_preview.ilike.%term%` — including the 120-char preview truncation: every writer truncates at write time (`.slice(0,120)`/`.substring(0,120)`: gmail-sync-now:275,434,568; inbox-gmail-sync:349,460; gmail-send-first-message:225; gmail-send-reply:260; inbox-gmail-send:317; inbox-twilio-send:252; inbox-sms-send:186; proof-send:429,546; the column itself is unbounded text).
- Org scope :23 `.eq('organization_id', organizationId)`. Other filters: status default 'open' :26-31, channel :33-35, unread_only :37-39, person_id/unlinked_only :41-45, primary_handle_exact :47-49. Sort :58-60 (last_message_at desc nulls-last, created_at desc).
- **No pagination** — no `.range()`/limit; the full open set is fetched every time (SM: 1005 rows, see B6).
- **No debounce anywhere in the chain**: input onChange → `setSearchQuery` (CustomerThreadList:254 / InboxConversationList:306) → `baseFilters` memo (UnifiedInboxPage:243-249) → new query key (`inboxKeys.conversations.lists(orgId, filters)`, hooks:26-27,106-108) → fetch per keystroke. Two-to-three list queries mount concurrently (page :278 channel-filtered, :281 baseFilters; useCustomerThreads:85 shares the baseFilters key with :281 → TanStack-deduped).
- The raw `searchTerm` is interpolated into PostgREST `.or()` grammar — a comma or parentheses in the search text corrupts the filter (bogus condition → wrong results or 400). An RPC parameter removes the class (F-027).

### B2 — inbox_conversations (catalog-verified)
**TABLE, not a view** — `relkind = 'r'`, `relrowsecurity = true`, reloptions null. Four policies, all `user_is_member_of_org(organization_id)`: org_select (r, USING), org_update (w), org_delete (d), org_insert (a, WITH CHECK only). 21 columns: id, channel, external_thread_id, primary_handle, subject, status, unread_count, last_message_at, last_message_preview, created_at, **person_id (uuid, NULLABLE — unlinked-conversation guard holds)**, link_state, link_meta, user_id, whatsapp_connection_mode, whatsapp_managed_connection_id, organization_id (NOT NULL), order_id, last_inbound_at, last_outbound_at, enquiry_stage.
`returns setof public.inbox_conversations` is **viable** (table row type); under SECURITY INVOKER the RLS policies apply inside the function. No security_invoker/view concern exists — it's a table.

### B3 — Precedent RPC — tracked file is stale
`supabase/migrations/20260423112000_get_customer_messages_rpc.sql`: `language sql stable`, **`security definer`** (:16), `set search_path = ''` (:17), `revoke all … from public; grant execute … to authenticated` (:28-29). Org-guard style in the tracked file: **trusts the caller-supplied `p_organization_id` parameter** with no membership check. Copy: the search_path pin and the revoke/grant pair. Do NOT copy: definer mode, param-trusted org scoping.
**NOTE (2026-09-02): this tracked file is NOT the live definition.** The live body carries a `user_is_member_of_org(p_organization_id)` gate (pg_proc-verified), added 2026-08-09 from `../SearsMelvin/migrations/2026-08-09-close-unsafe-rpcs.sql`; grants hardened by `2026-08-09-restrict-organization-rpcs.sql`. Replaying the Mason file restores the ungated body — replay hazard, see F-026.

### B4 — Blast radius of an RPC swap
- `fetchConversations` has exactly one caller: `useConversationsList` (useInboxConversations.ts:100-112).
- `useConversationsList` has **six call sites in five consumers**, several relying on non-search filters: UnifiedInboxPage:278 (channel-filtered) and :281 (baseFilters); useCustomerThreads.ts:85 (baseFilters); CustomerConversationView.tsx:139 (`{status:'open', person_id}`) and :144 (`{status:'open', unlinked_only, channel, primary_handle_exact}`); ConversationView.tsx:83 (`{status:'open', person_id}`).
- Query keys embed the whole filters object (hooks:26-27); realtime + fallback-poll invalidation targets `inboxKeys.conversations.all` (page :320); mark-read/unread does **cache surgery on the array shape** across all conversations.* queries (updateConversationUnreadCountInCache, hooks:53-97). A swap must return the identical row shape or the optimistic-read path breaks silently.
- Consequence: either the RPC honors every `ConversationFilters` param, or the swap branches inside `fetchConversations` (RPC only when `search` is present). Param typing changes: none, if the swap stays internal to `fetchConversations` — `ConversationFilters` is untouched.

### B5 — Sibling name-search inventory
All four located sites are **client-side filters over the full org people list** (not DB ilike; the recorded "First Last" defect is CONFIRMED at each):
- src/modules/inbox/components/PeopleSidebar.tsx:29-39 — `first_name/last_name/email/phone` each `.toLowerCase().includes(q)` separately → "First Last" matches nowhere.
- src/modules/inbox/components/LinkConversationModal.tsx:60-70 — identical predicate.
- src/modules/customers/pages/CustomersPage.tsx:57-68 — same shape on transformed firstName/lastName (this IS the "People search" page).
- src/shared/components/UniversalSearch.tsx:42-51 (⌘K, every page) — `[first_name, last_name, email, phone].some(includes)` → same defect. (CommandItem `value` :128 does contain the joined full name, but rows are pre-filtered by :42-51, so a full-name query still renders nothing.)
- The DB-ilike site is only the inbox itself (B1), which searches **conversation columns only — person names are not searched at all**: that is the Arin-visible inbox failure. The four sibling sites are a different mechanism (client-side) with the same symptom, each fixable by matching the joined name — no RPC involved.
- Source list feeding all four: `fetchCustomers` org-guarded `.eq("organization_id", …)` (useCustomers.ts:35-38).

### B6 — Index support + volumes (catalog/live-verified)
- `people` indexes: pkey; `idx_people_name` btree(last_name, first_name); `people_email_lower_idx` (lower(email)); `idx_people_email`; `idx_people_phone`; `idx_people_organization_id`; `people_portal_token_key`; `people_org_email_key` unique (org, lower(email)) where email not null. None help a leading-wildcard ILIKE; irrelevant at these volumes.
- `inbox_conversations` indexes: org_id; (status, last_message_at desc); (channel, primary_handle); partial (channel, external_thread_id); partial enquiry-pipeline (org, enquiry_stage, last_message_at) where open+order_id null; partial (person_id, last_message_at) where person_id not null; (link_state, last_message_at); person_id; user_id; order_id; last_inbound_at; last_outbound_at; whatsapp_managed_connection_id; pkey.
- `pg_trgm`: available, **NOT installed** (installed_version null).
- Live counts (2026-09-02): people — Churchill 204, SM 169. inbox_conversations — Churchill 539 (539 open), SM 1005 (1005 open). **An ILIKE join is trivially acceptable at these row counts; pg_trgm unnecessary today.** Both orgs are 100% status='open' — nothing has ever been archived (F-028).

### B7 — Search control placement
The search input is not in UnifiedInboxPage JSX — it sits in each list component's control stack: CustomerThreadList.tsx:248-257 (customers view) and InboxConversationList.tsx:300-309 (flat). State is page-owned (`searchQuery` :96, wired :1164-1167 / :1203-1206). It IS inside the block the cleanup reduces. De-confliction: the search cycle's only sensible UI touches are UnifiedInboxPage:96 and :243-249 (state/baseFilters/debounce) — everything JSX-side in CustomerThreadList:161-257 / InboxConversationList:195-309 belongs to the shell cycle. API/migration side (inboxConversations.api.ts:52-55 + new migration + inbox.types) has zero overlap with the shell.

---

## C. forceMount / class-hiding

### C1 — The mechanism
`forceMount` on all four `TabsContent` (PersonOrdersPanel.tsx:308, :378, :385, :388). Hiding is **not a JS className toggle** — it is a static class string carrying a data-state variant: `PANEL_BODY_CLASSES = 'flex-1 min-h-0 overflow-auto scrollbar-hide px-3 py-3 space-y-3 mt-0 data-[state=inactive]:hidden'` (:47-48), with the comment (:44-46) noting it deliberately adds no display utility so **both** `data-[state=inactive]:hidden` **and Radix's own `hidden` attribute** stay effective on force-mounted panels (AC-002).

### C2 — What the pattern actually protects
Because the tab bodies are presentational (A2), the per-tab forceMount protects less than CLAUDE.md's wording implies — the heavyweight state lives in PersonOrdersPanel, which is mounted regardless of active tab:
- Protected by PersonOrdersPanel staying mounted (NOT by forceMount): orders-count effect :111-119, all queries :62-100, drawer-open state :93-96 + open drawer form state (drawers mount at :393-415, outside Tabs), resolution state :85-86, autoSelectedPersonRef :165.
- Protected by per-tab forceMount specifically: each panel's **scroll position** (each TabsContent is its own scroll container, :48); OrderContextSummary's mount-time fetches (:25-26) not refiring/flashing on tab return; summaryRef/scrollIntoView + flash behavior :166-167, :355-360; focus within a panel.
- Message draft: column-2 composer (ConversationView/ConversationThread) — outside the shell entirely.
So a card shell's real invariants are two: (1) PersonOrdersPanel (or its successor host) stays mounted across selection/collapse; (2) card bodies stay mounted-but-hidden when collapsed, per the existing pattern.

### C3 — Collapsible substrate (constraints only)
- Available: shadcn Collapsible at `src/shared/components/ui/collapsible.tsx` — bare re-exports of `@radix-ui/react-collapsible` **^1.1.0** (package.json:29), zero styling/behavior added. **No Accordion** — no ui file, no `@radix-ui/react-accordion` dependency. Radix Tabs is ^1.1.0.
- Radix CollapsibleContent accepts `forceMount` (same Presence contract as Tabs), and stamps `data-state="open|closed"` — so today's exact hiding idiom transfers: `data-[state=closed]:hidden` in a static class.
- Height/animation constraint: Radix animates via `--radix-collapsible-content-height`, measured from content. A force-mounted child hidden with `display:none` measures 0, so **height transitions cannot be trusted with the tabs' hiding pattern** — non-animated open/close sidesteps it entirely; animated collapse would need a different hiding mechanism (e.g. Radix-managed without display:none), which conflicts with the scroll-position preservation above. This is the central shell-cycle tension to spec behaviorally (geometry/animation ruled at approval).
- One scrolling column also inverts the scroll ownership: today each TabsContent scrolls (:48); a card column wants the column container as the single `flex-1 min-h-0 overflow-auto` region with cards sized naturally — hidden card bodies must contribute zero height (display:none does).

### C4 — Scroll chain
PageShell (path is `src/components/layout/PageShell.tsx`): :151 `flex h-screen overflow-hidden` → :154 `flex-1 min-w-0 flex flex-col overflow-hidden` → content region :275-281 `flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-gardens-page` — **with the inbox nuance: padding is conditional and OFF for inbox** (`fullBleedRoutes = {'inbox'}` :65, template :276-278).
Below :275 on the inbox route:
- UnifiedInboxPage root :1061 `flex flex-col flex-1 min-h-0 overflow-hidden`
- workspace card :1120 `flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col border … rounded-lg`
- grid :1121-1131 `flex-1 min-h-0 grid … overflow-hidden`
- column 1 :1134-1140 `min-h-0 h-full flex flex-col overflow-hidden`; inner list wrapper :1143; list scroll container CustomerThreadList:259 / InboxConversationList:312-314 `flex-1 min-h-0 overflow-auto`
- column 2 :1293-1298 `flex flex-col min-h-0 h-full min-w-0 overflow-hidden` (thread scrolls internally)
- column 3 :1350 `hidden lg:flex lg:flex-col min-h-0 h-full min-w-0 overflow-hidden` → :1352 `flex-1 min-h-0 overflow-hidden` → :1353 `relative h-full` → PersonOrdersPanel:254 `h-full flex flex-col min-h-0 overflow-hidden` → Tabs :258 `flex-1 min-h-0 flex flex-col` → **each TabsContent :48 `flex-1 min-h-0 overflow-auto` is the scroll container today**.
- The inbox does **NOT** rely on :275's scroll — it is height-bound and overflow-hidden the whole way down (unlike pre-C9b Finance). A single scrolling card column slots into the existing chain at the :1352/PersonOrdersPanel level with no PageShell contact and no fight with :275.

---

## D. Control inventory + shell context

### D1 — Top-bar control inventory (customers view = the default inbox)
1. Select-all checkbox — CustomerThreadList:163-175; state selectedCustomerRowKeys (page :98); client-side.
2. **New** — :189-196 → NewConversationModal (page :1207-1211). Removing the button does NOT orphan the modal: ConversationView/CustomerConversationView still call `onRequestNewConversation` (page :1317-1320, :1341-1344) and empty-channel start (:693-714) — only the button goes; the modal + prefill plumbing (:121-129, :1002-1058) must stay.
3. Delete (renders when selection > 0) — :197-206 → BulkDeleteConversationsDialog.
4. Read/Unread toggle — :207-225.
5. Filter pill row All/Customers/Unread/Awaiting/Unlinked (+`Hidden (n)` when mutedCount>0) — :230-234, FILTER_BUTTONS :20-26, hidden pill :145-148; state listFilter (page :92). Fetch-feeding: `unread`→unread_only, `unlinked`→unlinked_only (page :243-249); customers/awaiting/hidden filter client-side (useCustomerThreads:141-164). **Removing "Hidden" orphans the whole muted-sender surface**: mutedCount plumbing (useCustomerThreads:118-139), and the Unmute button on rows (CustomerThreadList:387-401) is reachable ONLY under the hidden filter — removal strands muted senders invisible with no unmute path; mute/unmute API stays live (inboxConversations.api.ts:275-335). Needs a relocation decision, not deletion.
6. Channel dropdown — :235-245; state page :95; client-side group filter (useCustomerThreads:133).
7. Search input — :248-257; feeds the fetch `.or()` (B1).
8. Left-collapse button — page :1146-1155 (localStorage-persisted).
Page-level extras: Inbox|GHL source tabs (:1084-1113, state :89, not persisted); the flat `?view=flat` list keeps a parallel set (InboxConversationList: FILTER_BUTTONS :102-108 All/Unread/Urgent/Unlinked/Stuck, own New/Delete/Read/channel/search :195-309, "N stuck" header button :222-234). Reduction to ~Customers+Unread maps to existing pills; 'customers' is client-side, 'unread' a fetch param — both cheap survivors.

### D2 — Sidebar ownership: PageShell-owned (shared)
Rendered by PageShell:152 (`src/components/layout/Sidebar.tsx`); every `/dashboard/*` child route renders through it (router.tsx:59-101 — Hub, Finance, Inbox, Orders, Pipeline, Customers, Reporting, Settings… ~28 routes). Width source: Tailwind classes, `w-[56px]` collapsed / `w-[220px]` expanded (Sidebar.tsx:549; default collapsed via localStorage `nav.desktop.collapsed.v1`, :521-524). Icon sizing: single const `sz = 18` (:28) used by every nav icon. Truncation mechanism: nav labels have **no** truncate (:423); the visible truncation is **OrgSwitcher** — `truncate max-w-[140px]` (OrgSwitcher.tsx:16, :28). Sidebar polish therefore affects ~28 routes, not just the inbox.

### D3 — Vestigial `relative`
Confirmed: UnifiedInboxPage.tsx:1353 `<div className="relative h-full">` wrapping PersonOrdersPanel; nothing in PersonOrdersPanel positions absolutely against it. Backlog line stands.

### D4 — Baseline file
`scripts/gate-tsc.mjs:14` → `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt`. All references: CLAUDE.md:42; docs/tsc-clusters.md:4; docs/handoff.md (several blocks); specs/finance-gapfill-progress-bars-paid-fix-aging/spec.md:359 + plan.md:64,141; specs/finance-consolidation/tasks.md:157 + quickstart.md:3. **FLAG: the shell rebuild partially reverses the inbox-sidebar-multi-tabs feature, and the repo-wide tsc gate reads its baseline from inside that spec folder — nothing in the rebuild may relocate or clean up `specs/inbox-sidebar-multi-tabs/`.**

### D5 — Divergence from the Finance house pattern
- Selected chip pairing: InboxFilterPill.tsx:24 selected = **hardcoded hex** `bg-[#243D2E] text-white` — neither the PipelinePage.tsx:100-102 pairing (`background: var(--g-acc-lt)`, `border: var(--g-acc)`, verified) nor any token.
- No `aria-pressed` on any inbox pill (InboxFilterPill.tsx:18-30); only the Inbox|GHL switch has semantics (role=tab/aria-selected, page :1084-1113).
- Search: always-open input, not the C8 collapsing icon-button; no icon-only control anywhere (New/Delete/Read are icon+label); channel filter is a native `<select>`, not chips.
- Token style: the inbox uses **gardens-\* utility classes** (bg-gardens-page, text-gardens-txs, …) throughout plus the one raw hex — not the inline `var(--g-*)` style-object idiom Finance C4c used. docs/ux/tokens.md: absent as of 2026-09-02 (token pass not landed).

---

## For the spec — search cycle
- Extend search to person names (join `people` on `person_id`) — the Arin-visible failure; conversation columns alone never match a customer name.
- Keep the swap internal to `fetchConversations`; preserve or branch around ALL ConversationFilters params — five consumers depend on person_id / unlinked_only / channel / primary_handle_exact (B4).
- RPC: SECURITY INVOKER + `set search_path = ''` + `returns setof public.inbox_conversations` (viable — table with RLS; invoker applies it); copy only the precedent's search_path pin and revoke/grant pair, never its tracked definer mode or param-trusted org guard (B3 note; F-026).
- Return the identical row shape — mark-read cache surgery and realtime invalidation operate on the cached arrays (hooks:53-97).
- Add a debounce at the UnifiedInboxPage baseFilters level (:96, :243-249) — none exists; keep UI touch out of the list components (shell cycle's territory).
- RPC parameter also closes the `.or()` grammar-injection class (F-027).
- pg_trgm unnecessary at 373 people / 1544 conversations; plain ILIKE join acceptable. Pagination out of scope for the search cycle; the unpaginated 1005-row fetch is a backlog line.
- Regression guard: unlinked conversations (person_id null) must still match on handle/subject/preview after the join (left join semantics).

## For the spec — shell cycle
- The swap is cheaper than the backlog implies: tab bodies are presentational; all state/queries live in PersonOrdersPanel — spec the two invariants: host stays mounted; card bodies stay mounted-but-hidden (`data-[state=closed]:hidden`, the PANEL_BODY_CLASSES idiom transfers).
- One scrolling column = move scroll ownership from per-TabsContent (:48) to the column container; height-bound chain already exists to :1352 — no PageShell contact.
- Substrate constraint (not a choice): Radix Collapsible ^1.1.0 present, unstyled; NO Accordion in repo; height animation incompatible with display:none-hidden forced content — spec behavior, geometry/animation ruled at approval.
- Additional Options → Finance card: move OrderContextSummary's itemized block + its per-order query; requires either a per-order child in the Finance card (existing pattern) or a batch hook — Finance card stops being purely presentational either way.
- "New" removal: button only — modal + prefill plumbing has other live entry points (composer, empty-channel).
- "Hidden" demotion/removal strands muted senders (unmute is only reachable under that filter) — relocation decision needed.
- Reduce to Customers + Unread: both survive cheaply ('customers' client-side, 'unread' fetch param); orphan map per D1.
- Preserve: GHL source switch, `?conversation` deep link + customers-row resolution, `?view=flat`, `?channel`, localStorage collapse keys.
- Nothing may touch `specs/inbox-sidebar-multi-tabs/` (baseline lives there).
- Pattern alignment targets for approval-time rulings: PipelinePage:100-102 pairing, aria-pressed, collapsing search, replacing the `#243D2E` raw hex.
- Sidebar polish: PageShell-owned → separate item (~28 routes affected).
