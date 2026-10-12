# Implementation Plan: Order Name Display (deceased vs customer)

**Branch**: `feature/order-name-display` | **Spec**: `specs/order-name-display/spec.md` | **Date**: 2026-10-12
**Input**: spec rulings R-1..R-11, accepted defaults A-1..A-13. Every file:line below was re-read on 2026-10-12 against the branch HEAD d4103d2.

## Context

`orders.customer_name` = deceased, `orders.person_name` = living customer (R-1). Mason surfaces read the two columns the wrong way round: outbound permit chase emails greet the deceased, money and triage screens name the deceased as payer, and the order sidebar's edit mode turns the customer row into an input bound to the deceased column. This plan fixes reads only. It changes no writer, schema, view, RLS, edge function or data (FR-008).

## Shared pieces (C1)

- `src/modules/orders/utils/orderNames.ts` (new): `orderCustomerName(o: { person_name?: string | null })` and `orderDeceasedName(o: { customer_name?: string | null })`. Each returns the trimmed value, or null when the value is empty or whitespace. Exported from `src/modules/orders/index.ts` (the barrel currently exports pages, components, `INSCRIPTION_FONT_OPTIONS` and `computeTimelineProgress`). File shape follows `orderDisplayId.ts`; the test follows `paidOrderType.test.ts`.
- FR-002: every surface keeps its own existing placeholder when the customer is null, and uses `'—'` where it has none. It never falls back to `customer_name`. Chase greeting fallback = **"Dear Sir or Madam,"** (ruling 2026-10-12).

## Commits

### C1: FR-001 helpers + US1 permit/chase (P1)

| File | Re-anchored | Change |
|---|---|---|
| `orders/utils/orderNames.ts` + `.test.ts` | new | helpers; vitest: distinct, equal, `''`, whitespace, null |
| `orders/index.ts` | :6 | export both helpers |
| `permitTracker/api/permitTracker.api.ts` | :28-29 | delete the `deceased_name: row.person_name` mapping (select :12 already has both columns) |
| `permitTracker/types/permitTracker.types.ts` | :29 | remove `deceased_name` from `PermitOrder` (only readers are api:29, ConversationView:167 and PermitCard:33; `ChaseModal.tsx:34` is a string literal) |
| `permitTracker/components/PermitCard.tsx` | :33, :42, :51 | title (:42) = `orderCustomerName ?? '—'`; meta line (:51) deceased = `orderDeceasedName ?? '—'` |
| `permitTracker/utils/chaseTemplates.ts` | :39, :66, :94-95, :120-121 (uses :45, :48, :69, :100-103, :125-128) | deceased via `orderDeceasedName` (fallbacks 'the deceased' / 'Unknown' kept); customer via `orderCustomerName`; greeting `Dear ${customer},` or "Dear Sir or Madam," |
| `permitTracker/utils/chaseTemplates.test.ts` | new | scenarios 1–4: customer draft "Dear A" + "B's memorial"; cemetery single subject+body name B; multi bullet names B; no deceased gives "the deceased"; no customer gives "Dear Sir or Madam,", and B never appears in the greeting |
| `inbox/components/ConversationView.tsx` | :167 | delete the `deceased_name` line (`getChaseDraft` reads the helpers; the caller is `ConversationThread.tsx:630`) |
| `permitChase/api/permitChase.api.ts` | :38, :129, :162, :184 | add `person_name` to the `!inner` embed select and the Row type; `PermitOrder` gets `deceasedName: string \| null` and `customerName: string \| null` |
| `permitChase/pages/PermitChasePage.tsx` | :267, :407, :468 | A-12: card/row title = deceased (`?? '—'`) with the customer as subline; table "Customer" column (header :445) = customer `?? '—'` |

- **tsc**: 0 new items. Baseline key `ConversationView.tsx(209,38)` shifts to `(208,38)` because the :167 deletion is above it. The item-diff will show 1 NEW + 1 RESOLVED for the same item; re-anchor the baseline line in the same commit. No other touched file holds a baseline key.
- **lint**: 0 delta (touched files lint clean today; repo 8/19).
- **vitest**: +2 files, about 10 cases.
- **Blast radius**: Permit Tracker page (cards, ChaseModal drafts), inbox cemetery-chase chip, Permit Chase page. Outbound email text changes, but nothing is sent automatically: drafts open for staff to edit.
- **Browser (US1)**: Permit tracker, SM, an order in `form_sent`/`customer_completed`/`pending` with distinct names. Customer draft greets the customer and names the deceased; cemetery single and multi drafts name the deceased; card main = customer, meta = deceased. Same order through the inbox conversation's cemetery chase chip: identical names. Permit Chase page: title deceased, subline customer, table Customer column = customer. Name the order checked.

### C2: US2 OrderDetailsSidebar (P1), plus A-1

| File | Re-anchored | Change |
|---|---|---|
| `orders/components/OrderDetailsSidebar.tsx` | :366-383 | Customer card: always shows `currentUIOrder.customer` read-only (already `person_name` → customers join → '—', `orderTransform.ts:61-71`); the edit-mode `<Input>` bound to `customer_name` (:374-380) is removed from that row. New labelled row in the same card: label "Deceased:" (existing `text-sm text-muted-foreground w-16` label pattern, :416/:426); view `orderDeceasedName(currentOrder) ?? '—'`; edit `<Input aria-label="Deceased name">` bound to `customer_name` through the existing `handleFieldChange` |
| `orders/components/DeleteOrderDialog.tsx` | :56-57 | A-1: "delete order {ORD-N} for {customer} (deceased: {deceased})", leaving out missing parts |

- `handleEditSave` (:72-103) is untouched. It already sends `customer_name` along with the other 26 keys, so the payload is unchanged.
- **tsc**: 0 new. Baseline key `OrderDetailsSidebar.tsx(762,32)` shifts by the net lines added above it (expected about +8 to +12). Re-anchor in the same commit; state the exact count from the diff before applying.
- **lint**: 0.
- **Blast radius**: Orders page sidebar view and edit; the delete confirmation on any page that hosts `DeleteOrderDialog`. No writer change.
- **Browser (US2)**: Orders page, SM order with distinct names. The card shows the customer and the Deceased row shows the deceased. Edit → "Deceased name" input → save → `customer_name` updated, and the customer row is unchanged and not editable. Open #141 (equal-name) to see the same name in both rows. Open the delete dialog to check the wording; don't confirm.

### C3a: US3 money/triage display (P2), plus A-2, A-5, A-7

| File | Re-anchored | Change |
|---|---|---|
| `hub/api/hub.api.ts` | :101/:116 (A-5), :181/:199, :215/:221/:238 | add `person_name` to the three selects; sample customers and balance-chase use `orderCustomerName` (`'Unknown'` kept); recent payments: `customerName = order ? (orderCustomerName(order) ?? '—') : null`, so a linked order with no customer no longer shows "Unlinked payment". The guard on :216 is unchanged (C5). |
| `hub/pages/HubPage.tsx` | :146, :337, :386 | no change needed (they render the mapped fields); verify only |
| `priority/api/priority.api.ts` | selects :47, :58, :66, :73, :81; Row types :98, :136, :202, :257, :290; maps :111, :152, :172, :220, :238, :272, :306 | add `person_name`; `customerName: orderCustomerName(row) ?? '—'` (type stays `string`) |
| `reporting/hooks/useReporting.ts` | :324, :391 | add `person_name` to the `orders_with_options_total` select (the generated type has it, :5016); `customer: orderCustomerName(normalizedOrder) ?? ''` |
| `invoicing/components/ExpandedInvoiceOrders.tsx` | :172 | `orderCustomerName(order) ?? '—'` (`fetchOrdersByInvoice` selects `*`) |
| `payments/hooks/useUnmatchedPayments.ts` :11, `useMatchedPayments.ts` :14, `useOrderExtras.ts` :20/:49, `useOrderPayments.ts` :24/:41 | embed `orders(id, order_number, customer_name, person_id)` | add `person_name` |
| `payments/hooks/useOutstandingOrders.ts` | :21 | add `person_name` (`orders_with_balance` has it per the generated type, :4864) |
| `payments/types/reconciliation.types.ts` | :34, :66, :100 | add `person_name: string \| null` to the embed and OutstandingOrder types |
| `payments/components/ReconciliationTab.tsx` | :158 | customer `?? 'Unknown'` |
| `payments/components/OutstandingTable.tsx` :74, `ExtrasTable.tsx` :94 | "Order" column | A-7: main line = customer (`?? '—'` / `'Unknown'`); existing `#N` subline kept |
| `invoicing/components/InvoiceDetailSidebar.tsx` :885, `CreateInvoiceDrawer.tsx` :585, `EditInvoiceDrawer.tsx` :213 | A-2 | "Deceased: {orderDeceasedName ?? '—'} · {type}" |

- **tsc**: 0 new. Shifted keys: adding `person_name` lines to the priority Row types (:98, :136 above :142; plus :202 above :209) moves `priority.api.ts(142,19)` to about `(144,19)` and `(209,20)` to about `(212,20)`. Re-anchor in the same commit; exact offsets come from the diff. `hub.api.ts(232,15)`: the edits above it stay on their own lines, so the key holds and only the message text changes (benign, F-005). Invoicing baseline keys (`CreateInvoiceDrawer` :338/:425, `EditInvoiceDrawer` :100/:115/:149) sit above the A-2 edits and do not move.
- **lint**: 0.
- **vitest**: no change.
- **Blast radius**: display only. Hub (pipeline samples, balance chase, recent payments), Priority page, Reporting recent activity, Finance expanded invoice rows, invoice create/edit/detail order cards, Payments page (all three tabs, admin/member only). Payments hooks gain one embed column; no filter or guard changes.
- **Browser (US3, display)**: Hub balance-chase card for an SM order with a balance: name = customer. Priority row with "Chase customer": name = customer. Finance → expand an invoice: the order row = customer. Payments → Reconciliation "Customer" = customer; Outstanding/Extras "Order" main line = customer. Invoice drawer order card reads "Deceased: X · type". Name each record.

### C3b: US3 MatchModal search behaviour (R-11)

| File | Re-anchored | Change |
|---|---|---|
| `payments/utils/orderSearchFilter.ts` + `.test.ts` | new | R-11: `buildOrderNameSearchFilter(term)` returns `person_name.ilike."%t%",customer_name.ilike."%t%"`, where t escapes `\` → `\\`, then `"` → `\"`. Vitest: comma, parentheses, dot, O'Brien, hyphen, double quote, backslash. (`%`/`_` stay LIKE wildcards, same as today.) |
| `payments/components/MatchModal.tsx` | :39, :56, :61-69, :101, :131 | select + type add `person_name`; a numeric term still matches `order_number` (:65-66 unchanged); a text term uses `query.or(buildOrderNameSearchFilter(term))` in place of `ilike('customer_name', …)` (:68); placeholder (:101) "Search by customer, deceased or order number"; result row name (:131) = customer `?? '—'`. The :131 label goes in this commit so the whole file changes once and the result shows the person the new search matches. |

- **tsc**: 0 new; no baseline key in either file.
- **lint**: 0.
- **vitest**: +1 file, 7+ cases.
- **Blast radius**: MatchModal search only (Payments → Reconciliation → Match). The match set is wider (both names). The org guard (:57) is unchanged. A malformed `or()` string would 400 the search; the vitest cases and the browser check cover that.
- **Browser (US3, search)**: Payments → Reconciliation → Match on an unmatched payment: the customer's surname finds the SM order, the deceased's surname finds it, the order number finds it, and `O'Brien` / `a,b` / `x"y` / `a\b` return without a 400. Cancel without matching. Name the order.

### C4: US4 lists/inbox (P2), plus A-4, A-9

| File | Re-anchored | Change |
|---|---|---|
| `pipeline/pages/PipelinePage.tsx` | :190-196 | main = customer `?? 'No customer'`; "Deceased: {name}" subline whenever a deceased name exists; equality hiding at :192 removed (A-9) |
| `shared/components/UniversalSearch.tsx` | :152-157, :160 | `who` = customer `?? 'No customer'`; `sub` = ["Deceased: X", sku]; equality hiding at :155 removed; cmdk `value` (:160) must still carry BOTH names, or results that matched the deceased (filter keys :63-64, unchanged) get dropped by cmdk's own filter |
| `inbox/components/OrderContextSummary.tsx` | :105 | `customerName={orderCustomerName(order)}`, plus new `deceasedName={orderDeceasedName(order)}` |
| `inbox/components/InboxOrderSummaryCard.tsx` | :13, :37, :58-59 | new optional `deceasedName` prop, rendered as "Deceased: X" under the customer line, same classes |
| `proofReview/api/proofReview.api.ts` :38/:219, `ProofReviewPage.tsx` :195/:236/:408 | A-4 | rename field `customerName` → `deceasedName`; no visual change |

- **tsc**: 0 new; no baseline key in these files.
- **lint**: 0 (`PipelinePage.tsx:60` exhaustive-deps warning is pre-existing and counted in the 19).
- **Blast radius**: Pipeline page, Cmd-K search, inbox right-panel order card, Proof Review page (rename only).
- **Browser (US4)**: Pipeline (SM), universal search for an order number, and an inbox conversation with a linked order: customer is the main line, with "Deceased: X" below it. #141 shows the name twice (intentional, R-2). Searching the deceased's surname in Cmd-K still lists the order.

### C5: F-056 hub recent-payments org guard (own concern)

| File | Re-anchored | Change |
|---|---|---|
| `hub/api/hub.api.ts` | :216 | `.eq('orders.organization_id', organizationId)` becomes `.eq('organization_id', organizationId)` on `order_payments` (the column exists, generated type :2187; same pattern as `useMatchedPayments.ts:15` and `useUnmatchedPayments.ts:12`). The embed stays a left join, so unlinked payments (order_id null, shown as "Unlinked payment") are kept. **Ruling 2026-10-12: top-level eq, not `!inner`** (`!inner` would drop unlinked rows). `organization_id` can be dropped from the embed select. |

- **tsc**: 0 new; `hub.api.ts(232,15)` holds if the select stays on one line.
- **lint**: 0.
- **Blast radius**: Hub "Recent payments" only. Under the live RLS (F-056), rows visible to a member of more than one org now filter to the active org. No change for single-org users.
- **Browser**: Hub (SM) → Recent payments lists the same rows as before; if the account is a member of both orgs, switch org and confirm no other-org row appears. Name a payment checked.
- `finance.api.ts:200-202` (same pattern, dead hook, A-13) is left out of this commit (backlog).

## Docs commit (before C1): plan.md + spec amendments + backlog

Files: `specs/order-name-display/plan.md` (new), `specs/order-name-display/spec.md` (amendments below), `docs/backlog.md` (two items below).

Backlog additions (top block, next to the other order-name-display items):
- `chaseTemplates.ts` hard-codes the signature "Churchill Memorials" (:54, :74, :85, :111, :136) and the default sender 'Arin Melvin' (:12). SM permit chase drafts go out signed as Churchill. Needs a per-org sender/business name. Out of order-name-display.
- `priority.api.ts:87`: the `cemeteries` select has no query-layer `organization_id` guard (it relies on RLS), which breaks the CLAUDE.md "every data fetch org-guarded at the query layer" rule. Out of order-name-display.

### Spec amendments

1. FR-004: "Inline save payload unchanged in shape (`customer_name` only)" becomes "`handleEditSave` (:72-103) unchanged; its full update already carries `customer_name`".
2. A-1 anchor `:57-58` becomes `:56-57`.
3. R-9 / FR-005 / Out of scope: the F-056 fix is a top-level `organization_id` eq on `order_payments`, not `!inner` (keeps unlinked payments).
4. FR-002: customer chase greeting falls back to "Dear Sir or Madam,".
5. FR-003 permitChase: add `person_name` to the `!inner` embed select (the spec only says this for FR-005 selects).

## Verification (every commit)

- `npm run gate` (Giorgi): tsc item-diff 0 NEW after re-anchoring the named shifted keys; lint ≤ 8/19; vitest green.
- SC-001 grep at review, over the FR-003..FR-006 files: `person_name` only in selects/types/filter keys or through `orderCustomerName`; `customer_name` only in selects/types/search keys/the sidebar edit binding or through `orderDeceasedName`.
- Browser check on staging per commit as listed, naming the SM order.
- `reviewer` pass on each diff.

## Out of scope, seen during re-anchoring

Both logged to `docs/backlog.md` in the docs commit: the Churchill signature / 'Arin Melvin' sender in `chaseTemplates.ts`, and the missing query-layer org guard on the `priority.api.ts:87` `cemeteries` select.
