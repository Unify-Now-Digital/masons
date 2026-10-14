# Mason brand identity & design guidelines — v1 (draft, 14 Oct 2026)

The living source for ALL Mason design work. Code tokens live in `src/styles/tokens.css`; this file says how to use them. Change it by PR and add a changelog line.


## Design principles, spacing & structure (also in design-principles.md)

## Principles (7)
1. **One job per screen, one primary action per surface.** A row/card/panel has at most one filled button.
2. **Click opens in place.** An order or person opens the universal side panel; leaving the page is only for "Open full order".
3. **Words first, colour second.** Every status has a label; colour reinforces it (red act now · amber our move/money · blue waiting on them · green done · grey not started). The terracotta accent is brand, never a status.
4. **Show the number that decides.** Each row: who · what · how much · how long · the next action + why. No decorative metadata.
5. **Honest data.** Unknown is "£?" / "not recorded", never £0 or "—" pretending to be a value; test deals never shown.
6. **Same thing, same name, same place.** One term per concept (glossary), one ref format (ORD-245), one ranking source shared by Hub/Pipeline/Inbox.
7. **Calm density.** Strict spacing scale and type scale; align to the grid; nothing floats over content.

## Spacing scale — ONLY 4 / 8 / 12 / 16 / 24 / 32 px (Tailwind 1, 2, 3, 4, 6, 8)
| px | Tailwind | Use |
|---|---|---|
| 4 | 1 | icon↔label, chip internal gap, label↔sub-line |
| 8 | 2 | row vertical padding, gaps inside a row, between chips/pills |
| 12 | 3 | card padding (mobile), gap between cards in a column, row horizontal padding |
| 16 | 4 | card padding (desktop), section gap inside a page, side-panel section padding |
| 24 | 6 | page gutter ≥1440, gap between page columns |
| 32 | 8 | page top block / empty-state padding |
Banned: 0.5, 1.5, 2.5, 3.5, 5, 7, 10 and arbitrary `[..px]` for padding/margin/gap (exception: 2px hairline offsets with a comment).

**Measured today (phase5, src excl. landing/tests):** 2,351 padding/margin/gap utilities; **350 off-scale (15%)** — top offenders gap-1.5 (51), py-1.5 (48), mt-0.5 (32), px-1.5 (28), py-0.5 (26), px-2.5 (19), py-2.5 (13), gap-0.5 (13); 14 arbitrary values. Re-run: `rg -o "\b-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(\[[^\]]+\]|0\.5|1\.5|2\.5|3\.5|5|7|9|10|11|14|20|28)\b" src --glob '!*.test.*' --glob '!**/landing/**' | wc -l` (target 0 for new code, <50 after a clean-up pass).

## Layout grid / structure
| Region | Width | Rules |
|---|---|---|
| Rail | 72 px (icons + 11px label), mobile → bottom tab bar 56 px | active = solid fill; no page-title row |
| List column (Inbox, Orders list on narrow) | 360 px (min 320) | rows 8 px vertical / 12 px horizontal; dividers, no card per row |
| Content | fluid, max 1280 px inside gutters | page gutter 12 (mobile) / 16 / 24 (≥1440) |
| Side panel | 400 px desktop (overlay < 1280), full-height sheet on mobile | sections 16 px padding, 40 px tappable headers |
| Right column (Hub, Finance) | 320 px | cards stacked with 12 px gaps |
Headers: page has no title bar; a section header = 11px uppercase muted label + optional count, left-aligned with the content edge, 8 px above its content. Alignment: text left, money/numbers right & tabular, one left edge per column; pills right-aligned in rows. Full-height pages (Map, Inbox) fill the content area with `flex-1 min-h-0`, never `calc(100vh - N)`.

## Type scale
11 meta · 12 secondary · 13 body · 14 row title (Lora) · 17 section title · 22 KPI. Today: 14 arbitrary px sizes + 6 named.

## Radius
6 controls · 10 cards/panels · full pills. Today: 10 variants.

## Lint-able token list (proposed ESLint `no-restricted-syntax` / tailwind plugin allow-list)
- Colours: `gardens-{page,surf,bdr,tx,txs,txm-aa,acc,acc-lt,acc-dk}` + `gardens-na-{red,amber,blue,green}[-lt]` + `gardens-sem-grey[-lt]`. Ban raw `zinc|slate|gray|amber|red|green|blue|emerald|orange|yellow-NNN` (91 uses in 10 files today) and hex in className/style (36 distinct hex, 59 uses).
- Spacing: `(p|m|gap|space)-?(x|y|t|b|l|r)?-(0|1|2|3|4|6|8)` only.
- Text: `text-(11|12|13|14|17|22)px` via named tokens `text-meta|text-sec|text-body|text-title|text-section|text-kpi`.
- Radius: `rounded-control|rounded-card|rounded-full`.

---

## 0. What is inconsistent today (counted on phase5 @ 8255e48, `src/`, excl. landing/tests)
| Area | Variants found | Example |
|---|---|---|
| Colour tokens | **3 competing semantic palettes**: `--g-red/amb/grn/blu` (QA-10-14 re-mapped: "green" = navy #4A5A8A, "red" = terracotta #8A3A18, "amber" = the accent #C2693B), `--g-sem-*` (green = navy again), `--g-na-*` (true red #B42318 / amber #A15C07 / green #1E7B47 / blue #1D5FB4). Plus `--g-act-*` (5 action colours, comments still say "olive/berry/plum") | a "green" timeline bar renders navy; "amber" age text renders terracotta = same as the brand accent |
| Raw hex in components | 36 distinct hex values, 59 uses (map pins use ClickUp colours #f8ae00/#e16b16/#1090e0/#4466ff) | UkJobsMap, permitPins |
| Raw Tailwind palette (not tokens) | 91 uses in 10 files (`zinc-*`, `amber-*`, `red-*`…) | Map page is entirely zinc |
| Type sizes | 14 arbitrary px sizes (9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14, 15, 17, 18, 20, 22) + 6 named (xs…2xl). 11px alone: 264 uses | |
| Radius | 10 variants (rounded, -sm, -md 122, -lg 97, -xl, -2xl, -[10px], -full 92, -t, -r) | cards use both rounded-lg and rounded-[10px] |
| Next-action verbs | 15 spellings for ~8 actions: Request deposit · Create balance payment / Request balance · Record payment · Match · Raise invoice / Create invoice / INVOICE · Create order / Create order/invoice · Reply / REPLY · Call / CALL · Chase / CHASE · SOFT FUP · FLAG · WAIT | Hub uppercase, Inbox/Orders sentence case, Finance own set |
| Empty / none state | "Nothing due", "Nothing to do in X today", "none waiting", "—", "No orders in X" | |
| Two next-action modules | `src/shared/nextAction.ts` (style) + `src/shared/lib/nextAction.ts` (rules) + Hub `todayModel.ts` verbs + Finance `receivables.ts` actions | |
| Same concept, different numbers | Hub Abandoned 60–89d / Close 90+d vs Pipeline Revive 60–90 / Close-as-abandoned 90+ | 18/27 vs 14/20 |
| Proof statuses | data has In_Progress, Lettered, Not_Received, Received; picker offers Sent, Revision, Approved | |
| Order ref | "ORD-000245" (Orders/map), "#245" (Hub), "OR-245" (Search, old Pipeline) | |

## 1. Tokens (proposal)
**Brand:** paper `#F2EEE5` page · `#FDFBF6` surface · ink `#1A1815` / `#5C554A` / `#6E6961` (AA muted) · border `#DED9CE` · accent terracotta `#C2693B` (brand only: active rail, primary button, links — never a status).
**Status (one palette, = `--g-na-*`, light + dark already defined):**
| Token | Hex | Meaning (one meaning only) |
|---|---|---|
| status-red | #B42318 | act now: overdue / blocked on us |
| status-amber | #A15C07 | our move soon, money to collect |
| status-blue | #1D5FB4 | waiting on them (family, cemetery, Stripe) |
| status-green | #1E7B47 | done / paid / approved |
| status-grey | #9A958C | not started / unknown / n/a |
Retire `--g-red/amb/grn/blu`, `--g-sem-*`, `--g-act-*` by aliasing them to the above, then delete. Map pin colours move to the same five (permit: not started grey-hollow, form with family blue, signed-submit amber, with cemetery blue, approved green).
**Type scale (6 steps):** 11 meta · 12 secondary · 13 body (default) · 14 row title (Lora) · 17 section title · 22 page number/KPI. Ban the rest (9/9.5/10/10.5/11.5/15/18/20).
**Spacing:** 4 / 8 / 12 / 16 / 24 / 32 only — see the principles section above.
**Radius:** 6 control (button, input, chip-square) · 10 card/panel · full pill. Nothing else.

## 2. Components
- **Button**: primary (accent fill), secondary (surface + border), ghost (text). Heights 32 desktop / 40 mobile tap. Label = verb from the glossary. One primary per surface.
- **Next-action pill** (only for "our move"): status colour tint + icon + verb; reason line underneath in 12px status colour. Never shown for "on track".
- **Status chip** (state, not action): `Label value` e.g. `Permit · With cemetery`, tint of the status colour, 11px semibold, pill radius. Used for permit, proof, stone, invoice.
- **Data card (KPI)**: label (11px uppercase muted) · value (22px) · one-line definition (12px) · optional delta. Clicking a card filters the list below; never navigates.
- **Table row**: 14px name + 12px sub-line; ref in mono 11px; money right-aligned tabular; row click = open side panel.
- **Progress bars** (6px, radius full, track = border): Timeline (weeks elapsed / planned; green under plan, red over) · Paid (paid / value+permit; amber partial, green 100%; hatched "£?" when a deposit date exists without an amount).
- **Side panel section**: 13px header + chevron, 40px tap height, max one primary button.
- **Empty state**: one sentence, what will make something appear ("No confirmed orders. Orders appear here when a deposit is recorded.").

## 3. Glossary — one term per concept
| Concept | Use | Don't use |
|---|---|---|
| A family's first contact | **Enquiry** | inquiry, lead (except in Finance flow "leads") |
| Sale in progress | **Deal** (pipeline) | job, opportunity |
| Confirmed work | **Order** | job |
| Order ref | **ORD-245** everywhere | #245, OR-245, ORD-000245 |
| Money in before work | **Deposit** (50%) | first payment |
| Money in at fixing | **Balance** | second payment, final |
| Installation | **Fixing** | install, installed |
| Nothing for us to do | **On track** | Nothing due, none waiting |
| Quiet 60+ days | **Gone quiet** → **Close** | abandoned/revive/re-quote (three words today) |
**Next-action verbs (closed list, sentence case):** Reply · Call · Send quote · Follow up · Create order · Create invoice · Chase payment · Record payment · Request balance · Send permit form · Submit permit · Send proof · Escalate. State words (not verbs): Waiting on family / cemetery · On track · Done.
**Symbols (lucide):** Reply MessageCircleReply · Call Phone · Follow up/Chase BellRing · Money PoundSterling · Invoice Receipt · Create FilePlus2 · Waiting Clock · Done CheckCircle2 · Escalate Flag · Permit FileSignature · Proof PenTool · Fixing Hammer. Icon always with a word, never alone.

## 4. Data-card spec
**Finance (proposed 5 cards, "Deposits to request" removed):**
| Card | Number | Definition | Source |
|---|---|---|---|
| Cash in this month | £ | Σ order_payments (matched) + invoice_payments (succeeded, pence/100) received this calendar month; sub-line Revolut / Stripe / other | order_payments, invoice_payments |
| Owed to us | £ | Σ (value + permit − paid) on open orders where paid is known; **orders with a deposit date but no amount are counted separately** ("+n deposits not recorded") | orders, order_payments, invoice_payments |
| Balances due at fixing (≤30d) | £ | remaining on orders whose fixing date ≤ 30 days (or stone In Stock) | orders.installation_date |
| Invoices unpaid | £ + count | live Stripe invoices open; void-in-Stripe shown as a red sub-line to reconcile | invoices |
| **Projected revenue (next 90d)** | £ | Σ remaining on confirmed orders with fixing ≤ 90d **+** Σ quoted/invoiced deal value × stage conversion (quoted→deposit and invoiced→deposit, measured from the last 12 months) | orders, jobs, enquiries.details.price |
"Cash in today" folds into the month card's sub-line (it is usually £0 and takes a full card).
**Hub cards:** none (the Hub is a work list; counts live in the lane tabs).

## 5. DECISIONS NEEDED FROM ARIN
1. **Status colours** — A) one 5-colour status palette (red/amber/blue/green/grey) separate from the terracotta brand accent *(recommended)*; B) keep the QA-10-14 navy+terracotta-only palette (statuses become hard to tell apart); C) A, but money gets its own amber and permits use blue/green only.
2. **Money vs permit** — A) money = amber until paid then green; permit = blue while with family/cemetery, amber when it's our move, green approved *(recommended)*; B) money always its own colour (e.g. teal) regardless of state.
3. **Deposit actions wording** — A) "Create invoice" (no invoice yet) → "Chase payment" (invoice sent) → "Record payment" (paid off-Stripe) *(recommended)*; B) keep "Request deposit / Request balance".
4. **"Nothing due" wording** — A) "On track" *(recommended, on preview)*; B) blank cell; C) "Waiting on …" with who.
5. **Finance cards** — A) the 5 above incl. Projected revenue *(recommended)*; B) keep current 6 minus Deposits to request; C) 3 cards (Cash in month · Owed · Projected) + the lead flow.
6. **Order ref format** — A) ORD-245 *(recommended)*; B) ORD-000245; C) #245.
7. **Hub clean-up lists** — A) one collapsed "Pipeline clean-up (n)" card on Hub, full lists live in Pipeline *(recommended, on preview)*; B) remove from Hub entirely; C) keep as is.
8. **Orphan pages** (/priority, /jobs, /payments, /reporting, /workers, /activity, old /pipeline, old /map) — A) delete routes *(recommended)*; B) hide behind admin.
9. **Proof statuses** — A) Not received → Received → Sent → Revision → Approved → Lettered, migrate In_Progress → Sent *(recommended)*; B) keep legacy values visible.


## Changelog
- **v1 · 14 Oct 2026** — first version from the Phase-1 audit: principles, spacing/type/radius scales, one status palette, glossary + next-action verbs, data-card spec, open decisions.
