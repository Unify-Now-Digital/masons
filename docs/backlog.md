# Backlog
Updated: 2026-09-01

- Move specs/rls-isolation-findings.md to docs/ (update CLAUDE.md pointer).
- Inbox search RPC fix (Option C). Day 7.
- Stripe line-item audit on checkout/invoice. Day 7.
- Pipeline order/invoice enrichment. After Day 7.
- vitest include should be restricted to src/**/*.test.{ts,tsx} before Playwright specs land (B1) — otherwise e2e/*.spec.ts is collected too.
- Schema snapshot (supabase db dump --schema public) deferred: CLI login-role conflict (cli_login_postgres); needs --db-url with DB password or role cleanup. Do before Day 9.
- Prune the 9 unreferenced template agents in .claude/agents/ (code-refactorer … translation-auditor) — none used; decide keep/delete in Day 12 cleanup.
- block-secrets fails open when CLAUDE.local.md is absent (fresh clone). Consider failing closed with a clear message.
- .claude/hooks/*.mjs and scripts/*.mjs are outside every gate (lint glob is ts/tsx only). Add an eslint override or a node --check step.
- block-bash.check.mjs hard-codes a Windows username/repo path; parametrise via CLAUDE_PROJECT_DIR.
- F-014 remediation: replace client-side VITE_INBOX_ADMIN_TOKEN on Stripe
  function calls with user-JWT auth (or server-side check). Security.
- Same isLocked guard for SearsMelvin portal writers — shared-schema
  protocol item (portal writes bypass RLS via service key; Mason-side
  lock is UI-only for it).

## Product track (from Arin call, 2026-08-26)
- ~~P0: Churchill £1 invoice bug — invoice created at £1,200 rendered as
  £1 in Stripe, observed live by Arin.~~ RESOLVED T5 2026-09-01 (root
  cause: invoice-first creation + instant Stripe finalize + later edit
  never re-syncing — not pounds/pence; fix: deferred Stripe creation +
  lock-after-finalize + mismatch tripwire; see docs/handoff.md T-block).
- P1: Finance consolidation — merge Hub finance view and Invoices page
  into one (Hub format wins). Add "All" tile beside ≤7d/7–30d/30+d/not
  yet due. Remove bottom due-horizon bar. Carry over permit cost,
  additional options cost, remaining. Default to maximal columns.
- P1: Inbox UX cleanup — replace sidebar tabs with one column of
  collapsible cards (partially reverses shipped task #3; the four panels
  stay, only the tab shell changes). Move Additional Options into the
  Finance card. Remove "New" button and "Hidden" filter. Reduce eight
  top-bar controls to ~Customers + Unread. More contrast, fewer lines,
  larger sidebar icons, fix sidebar label truncation, narrower sidebar.
- P1: F-017: expire open checkout sessions in all three void paths.
  Investigate first (read-only): does Mason store partial-session ids,
  or must sessions be listed by customer/payment_intent from Stripe
  (Search API doesn't cover sessions)?
- P2: Timeline progress bar on orders — weeks elapsed vs timeline_weeks
  measured from payment date; red when over.
- P2: Churchill invoice structure — confirm alignment with SM; remove
  order number from invoice (possibly to memo); add product name, colour,
  memorial type, 50%-deposit indicator; verify edit-then-recreate flow.
- P2: Investigate invoices Arin believes he created that don't appear.
- P2: Roll approved column-filtering pattern onto Invoices and Pipeline.
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
- Shared-schema protocol with the portal team.
- Standing: F3 orders-page visibility, broken edit-link emails, product
  config corruption on orders 251/252.

## Carried
- Revise handler invalidates invoicesKeys.* only; person-keyed order
  probes can show stale invoice linkage until refetch (reviewer, T5b).