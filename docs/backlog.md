# Backlog
Updated: 2026-09-03

- Move specs/rls-isolation-findings.md to docs/ (update CLAUDE.md pointer).
- Inbox name search is tokenised (any word order); the four client-side surfaces (PeopleSidebar, LinkConversationModal, CustomersPage, UniversalSearch) match single-space-joined only — "Last, First" works in the inbox and nowhere else. Deliberate 2026-09-03; revisit if staff hit it.
- Stripe line-item audit on checkout/invoice. Day 7.
- Pipeline order/invoice enrichment. After Day 7.
- vitest include should be restricted to src/**/*.test.{ts,tsx} before Playwright specs land (B1) — otherwise e2e/*.spec.ts is collected too.
- Schema snapshot (supabase db dump --schema public) deferred: CLI login-role conflict (cli_login_postgres); needs --db-url with DB password or role cleanup. PRIORITY RAISED 2026-09-02: a tracked schema snapshot is what makes migration drift visible (F-026); the --db-url workaround is known. Do before Day 9.
- Prune the 9 unreferenced template agents in .claude/agents/ (code-refactorer … translation-auditor) — none used; decide keep/delete in Day 12 cleanup.
- block-secrets fails open when CLAUDE.local.md is absent (fresh clone). Consider failing closed with a clear message.
- .claude/hooks/*.mjs and scripts/*.mjs are outside every gate (lint glob is ts/tsx only). Add an eslint override or a node --check step.
- block-bash.check.mjs hard-codes a Windows username/repo path; parametrise via CLAUDE_PROJECT_DIR.
- F-014 remediation: replace client-side VITE_INBOX_ADMIN_TOKEN on Stripe
  function calls with user-JWT auth (or server-side check). Security.
- Same isLocked guard for SearsMelvin portal writers — shared-schema
  protocol item (portal writes bypass RLS via service key; Mason-side
  lock is UI-only for it).
- OrdersPage `?tab=` URL param so the Finance "Confirmed orders" stat can
  address the Confirmed tab explicitly — today it lands there only because
  'confirmed' is the OrdersPage default tab (spec finance-consolidation
  tension A1-1; comment at the navigate in FinancePage.tsx).
- Invoices header-click sorting — deferred from finance consolidation
  (FR-012; default sort is due-date asc, header `sortable` flags are
  decorative).
- Flag-gated Finance tabs (BalanceChaseTab/ExtrasTab/PaymentsTab/AI
  banner, off since 2026-07-19) DELETED in C5 a161be1 — git history
  retains; restore = revert.
- shared/-promotion: finance↔invoicing coupling deepened by the
  consolidation (filter props across the boundary; canonical money
  helpers in modules/finance consumed by invoicing) — promote helpers/
  table to src/shared/ if it strains again (plan.md Complexity
  Tracking).
- formatInvoiceRemaining kept at C5 (ruled — canonical per CLAUDE.md
  money rules) though the consolidation reduced its consumers; removing
  it requires a CLAUDE.md edit first.
- installation_date is null on ALL live orders (both orgs, 2026-09-02):
  Finance "Expected this month" stat + filter are inert (£0/empty)
  until installs are dated. Arin-visible fact.
- Migration drift audit (Mason tracked vs live vs ../SearsMelvin). Scope:
  SECURITY DEFINER functions, RLS policies, anon/authenticated grants, view
  security_invoker. Classify three outcomes: live safer than tracked
  (replay hazard, F-026 class), live weaker than tracked (real hole), live
  objects with no tracked source. Then one idempotent Mason migration
  re-recording hardened definitions so replay converges on live. Before
  Day 9.
- Inbox conversation fetch is unpaginated (SM 1005 rows) — 300 ms
  debounce landed 2026-09-03 (full-name-search C3); pagination deferred
  out of the search cycle (F-028).
- ~~Unmute is reachable only under the "Hidden" filter
  (CustomerThreadList:387-401) — relocation required before that filter is
  demoted.~~ MOOT: "Hidden" STAYS (ruled 2026-09-02, spec FR-011); the
  filter is not being demoted, so no relocation is required. Revive only
  if a later cycle demotes it.
- ?view=flat parallel control stack exempt from the Block 3 shell cleanup
  (ruled 2026-09-02) — decide later whether to align it to the rebuilt
  customers view or delete the escape hatch entirely.
- ~~Customers view lost manual mark-unread when bulk selection was dropped
  (Block 3 shell cycle, ruled 2026-09-03) — restore as a per-row action if
  Arin misses it.~~ SATISFIED at C3c 73af77e (2026-09-03): restored as an
  icon-only action on the selected row (R-001 partially reversed, spec
  FR-010 amendment).
- Bulk delete is the ONE visible removal left from the shell cycle (ruled,
  not broke — spec FR-010). Flag it at the next Arin call alongside the
  rebuild demo. Bulk read/unread also stays gone; mention only if he asks
  about multi-select. (tasks T605)
- Dead ref cleanup in UnifiedInboxPage: `suppressCustomersAutoSelectRef`
  is inert since C3a — initialised `false`, written `false` at five sites
  (:234, :582, :612, :1198, :1307), `true` at none, and it still gates the
  customers auto-select effect at :586 with a branch that can never be
  taken. Delete the ref, its five writes and that branch; also refresh the
  stale `customersDeepLinkConversationIdRef` comment at :120 ("e.g. after
  mark-unread" — C3c's mark-unread keeps the row selected, so no such
  reset exists). Evidence and the sibling trap: F-029.
- GHL Inbox pane hidden behind `SHOW_GHL_INBOX_TAB = false` in
  UnifiedInboxPage.tsx (C5b, 2026-09-03). Flip to `true` to bring the switch —
  and with it the only entry point to GhlInboxPage — back, no other edit. If the
  GHL merge is abandoned instead, delete the flag, the switch JSX,
  `inboxSource`/`setInboxSource`, the body ternary and the GhlInboxPage import
  together; whether the `ghl-inbox` module, the sync and router.tsx:77's redirect
  also go is a separate decision. Decide when the merge is resumed or dropped —
  evidence in F-030.
- Inline email iframe sandbox: decide whether ConversationThread.tsx:1316 drops
  `allow-scripts` to match the viewer dialog's `sandbox=""` (:1694, same
  content), or the regex-only `sanitizeHtml` (:78-89) gains a real DOM parser
  with a tag/attribute allowlist. Not a styling task. **No longer independent of
  message rendering (C10, 2026-09-03)**: content-sized frames measure
  `contentDocument`, so dropping `allow-same-origin` now also costs the sizing
  mechanism and forces a postMessage channel that needs per-message iframe ids and
  a parent listener built first. The sanitiser half remains independent. Line refs
  above are pre-hide and pre-C10 — re-anchor with the F-032 refs before acting.
  Evidence: F-032 and its C10 addendum.
- Migration drift audit — OVERDUE, not queued. Two confirmed instances now, both
  found by accident during unrelated work: F-026 (tracked
  20260423112000_get_customer_messages_rpc.sql holds an ungated SECURITY DEFINER
  body the live DB no longer has — replaying it reopens the hole) and F-033
  (20260403160000_add_message_type_to_inbox_messages.sql never applied and not
  recorded in schema_migrations; ships a live broken staff affordance, verified
  400/42703). The two point in OPPOSITE directions — live ahead of the file, and
  file ahead of live — so neither a replay nor a catch-up pass is safe without a
  full reconciliation. The Dashboard is the only apply path and applies
  statement-by-statement by hand, so nothing detects a skipped or partial
  migration: the true count is unknown and is only ever discovered incidentally.
  Audit every tracked migration against the live catalog before further schema
  work, and settle apply-vs-remove for F-033 as part of it.

## Product track (from Arin call, 2026-08-26)
- ~~P0: Churchill £1 invoice bug — invoice created at £1,200 rendered as
  £1 in Stripe, observed live by Arin.~~ RESOLVED T5 2026-09-01 (root
  cause: invoice-first creation + instant Stripe finalize + later edit
  never re-syncing — not pounds/pence; fix: deferred Stripe creation +
  lock-after-finalize + mismatch tripwire; see docs/handoff.md T-block).
- ~~P1: Finance consolidation — merge Hub finance view and Invoices page
  into one (Hub format wins). Add "All" tile beside ≤7d/7–30d/30+d/not
  yet due. Remove bottom due-horizon bar. Carry over permit cost,
  additional options cost, remaining. Default to maximal columns.~~
  SHIPPED 2026-09-02 (feature/finance-consolidation C1–C9c + docs C6;
  see docs/handoff.md T7-C6).
- ~~P1: Inbox UX cleanup — replace sidebar tabs with one column of
  collapsible cards (partially reverses shipped task #3; the four panels
  stay, only the tab shell changes). Move Additional Options into the
  Finance card. Remove "New" button. Reduce eight top-bar controls.
  More contrast, fewer lines.~~ SHIPPED 2026-09-03
  (feature/inbox-shell-rebuild C1–C4 + Phase 6 docs; see docs/handoff.md
  T14). Two pre-spec decisions did NOT ship as written: "Hidden" STAYS
  (ruled 2026-09-02) and the Unread pill was replaced by an icon-only
  toggle, then made an independent filter dimension at C3c — the struck
  text above is trimmed of both rather than left contradicting the code.
  The pre-spec control decisions are superseded by
  specs/inbox-shell-rebuild/spec.md (FR-009–FR-015, R-001–R-004) and
  dropped from here rather than restated.
- P1: Sidebar polish — larger icons, fix label truncation, narrower
  sidebar. Spun out of the Inbox UX cleanup item (ruled 2026-09-02, T8):
  PageShell-owned, so it changes ~28 routes, not just the inbox. Anchors
  from the audit (docs/ux/inbox.md D2, pinned 1ab595a): width
  w-[56px]/w-[220px] Sidebar.tsx:549, icon size single const sz = 18 :28,
  and the visible truncation is OrgSwitcher.tsx:16,:28
  (truncate max-w-[140px]) — nav labels have no truncate at all (:423).
  IN PROGRESS C8 2026-09-03: width (220 → 192, collapsed 56 unchanged) and
  label truncation (min-w-0 + truncate on the nav label span; OrgSwitcher
  cap 140 → 92) are applied, awaiting Giorgi's gate/verify/commit. Larger
  icons (sz = 18) NOT done — not ruled, still open. Strike this item only
  when the icon question is settled.
- P1: Hardcoded "THIS WEEK / −4.2 days / avg. turnaround" pill in the top
  bar (PageShell.tsx:178-211) — fabricated metric on a client-facing
  surface, identical for both live orgs, visible at lg+ on ~28 routes.
  See findings F-031. Decide: wire it to a real turnaround calculation, or
  delete the block. Do not leave it as-is.
- ~~P1: F-017: expire open checkout sessions in all three void paths.~~
  Done T6 2026-09-01 (stored-id expiry + list-by-customer sweep + webhook
  guard; see findings F-017). Residuals spun out: F-018 (cs_ ids in
  invoice_payments), F-019 (standalone silent drop). F-020 (attachPayment
  absent from stripe@14.21.0) found and fixed in the same batch (C6, raw
  attach_payment POST).
- P2: Timeline progress bar on orders — weeks elapsed vs timeline_weeks
  measured from payment date; red when over.
- P2: Churchill invoice structure — confirm alignment with SM; remove
  order number from invoice (possibly to memo); add product name, colour,
  memorial type, 50%-deposit indicator; verify edit-then-recreate flow.
- P2: Investigate invoices Arin believes he created that don't appear.
- P2: Roll approved column-filtering pattern onto Pipeline (invoices
  side shipped in finance consolidation, C3 779941c).
- Route is /dashboard/inquiries while the page is Pipeline. Cosmetic.
- /plan and /tasks call .specify/scripts/bash/setup-plan.sh and
  check-prerequisites.sh — neither exists. Both commands fail step 1 and
  improvise (flat *-implementation-plan.md files in specs/_archive are
  the evidence). Decide: port the two scripts from the PowerShell suite,
  or document the improvised path as the real workflow.
- Vestigial `relative` class at UnifiedInboxPage.tsx:1323 (was :1353 —
  shifted by the shell cycle).
- gmail-fetch-message-html retrieves the HTML and DISCARDS it: nothing is
  written back, so the client re-fetches the same 264 blank-body_html rows
  every session — an OAuth refresh_token exchange plus a Gmail
  messages.get?format=full per message, per session, forever. Either the
  function writes body_html back, or gmail-sync-now stores what
  _shared/gmailBody.ts extractBodyHtml already returns at ingest, plus a
  backfill decision for the existing 264. This RETIRES the prefetch rather
  than pacing it — C9 paces a cost that should not recur. Evidence: T18,
  C9 investigation (2026-09-03; 264 of 1,049 live email rows, all 264
  carrying a Gmail messageId).
- Email-HTML fetch errors reach staff as the edge function's RAW text
  ("Failed to fetch Gmail message: <raw Gmail API body>") at
  ConversationThread.tsx — same class as F-033's raw Postgres error in
  front of staff. C9 deduped the wall (one line per distinct string, not
  per message) but left the wording: map to one staff-readable sentence
  with the raw text going to console. Second half: the surviving line sits
  on a message row, so it scrolls off with that row — a pinned list-level
  banner is the fuller form. Filed at C9 approval, deliberately not folded
  into that commit.

## Awaiting Arin
- Four payments linked to wrong Stripe invoices, £8,046 (Anne Marshall
  £986.50, Ali Hazrati £1,500, Robert Barnett £3,339.50, Nichola Henry
  £1,220). Needs per-customer written confirmation before any repoint —
  live-money write discipline: SELECT-first, org-guarded, RETURNING,
  read-back.
- Duplicate May 27 Stripe draft, £1,982.80.
- Whether old unpaid website-enquiry invoices should be purged/filtered.
- Seed/Clear removed with the test toggle — confirm not needed.
- Shared-schema protocol with the portal team. Portal team's Stripe
  webhook (searsmelvin.co.uk/api/stripe-webhook) also consumes invoice.*
  events on the same account — clarify who owns invoice-state writes
  (noted during F-017 live verify, 2026-09-01).
- Standing: F3 orders-page visibility, broken edit-link emails, product
  config corruption on orders 251/252.

## Carried
- Revise handler invalidates invoicesKeys.* only; person-keyed order
  probes can show stale invoice linkage until refetch (reviewer, T5b).