# Backlog
Updated: 2026-09-02

- Move specs/rls-isolation-findings.md to docs/ (update CLAUDE.md pointer).
- Inbox search RPC fix (Option C). Day 7.
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
- Inbox conversation fetch is unpaginated (SM 1005 rows, refetched per
  keystroke, no debounce) — pagination deferred out of the search cycle
  (F-028).
- Unmute is reachable only under the "Hidden" filter
  (CustomerThreadList:387-401) — relocation required before that filter is
  demoted.
- ?view=flat parallel control stack exempt from the Block 3 shell cleanup
  (ruled 2026-09-02) — decide later whether to align it to the rebuilt
  customers view or delete the escape hatch entirely.

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
- P1: Inbox UX cleanup — replace sidebar tabs with one column of
  collapsible cards (partially reverses shipped task #3; the four panels
  stay, only the tab shell changes). Move Additional Options into the
  Finance card. Remove "New" button and "Hidden" filter. Reduce eight
  top-bar controls to ~Customers + Unread. More contrast, fewer lines,
  larger sidebar icons, fix sidebar label truncation, narrower sidebar.
    Shell-cycle control decisions (ruled 2026-09-02, pre-spec):
  - "+ New" → icon-only "+", relocated to the top bar beside the list
    collapse button. Crosses a component boundary: collapse is page-level
    (UnifiedInboxPage:1146-1155), New is CustomerThreadList:189-196 —
    props change, not a CSS move.
  - Bulk selection dropped: select-all checkbox + "Customers · N new"
    header text removed. Consequence — the bulk Delete button
    (CustomerThreadList:197-206) and the bulk Read/Unread toggle (:207-225)
    lose their only selection source and go with it.
  - Unread: decide at spec time whether the icon-only control beside "+"
    is the FILTER (already exists as a pill, :230-234) or the bulk action
    (:207-225, dies with bulk selection). They are different controls.
  - Awaiting and Unlinked filter pills removed. Unlinked conversations stay
    discoverable via the inline row tag; the filter was the only way to
    isolate them.
  - "Hidden" filter STAYS for now — supersedes the earlier demotion ruling
    and the unmute-relocation backlog line (both moot while it stays).
  - Channel dropdown shrinks.
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
- create-new-feature.sh sanitiser (spaces→hyphens, line 18).
- Vestigial `relative` class at UnifiedInboxPage.tsx:1353.

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