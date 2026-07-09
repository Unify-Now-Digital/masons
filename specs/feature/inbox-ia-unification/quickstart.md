# Quickstart: validating Inbox IA Unification

**Test org**: Sears Melvin only (`CLAUDE.local.md`) — the sole org with inbox volume (223 open conversations). Churchill is live production with 1 conversation: never write to it; it only smoke-tests empty states. All validation is read-only except the pre-existing per-row "mark in progress" action (avoid it on real org data; observe, don't click).

## 0. Static gates (before any manual pass)

```bash
npx tsc --noEmit   # must be clean — vite build does NOT typecheck
npm run lint
```

## 1. Dev server

```bash
npm run dev
```

Log in as a Sears Melvin user; open `/dashboard/inbox`.

## 2. View-switch matrix (US1)

| Check | Expected |
|---|---|
| Fresh load, no params, no stored prefs | By customer view (default D3), three tabs visible, board absent |
| Click All / To triage / By customer | list-shaped surface each time; URL shows `?view=`; pills + search persist across switches |
| Board toggle on | kanban replaces list (as legacy Enquiries segment); toggle off returns to prior view |
| `Unlinked` | appears once, as a pill only |

## 3. Triage ground-truth check (US2 + spec risk note — do this BEFORE building the view, again after)

In the All view, note the "N stuck" pill count (red-only) and eyeball amber badges. Then in To triage:
- non-empty, strictly fewer rows than All (SC-003);
- every row shows an aging badge with either "us owes" or amber/red;
- a conversation that was replied to and is fresh does NOT appear;
- stuck pill inside triage filters further (stuck ⊂ triage).

If the triage count ≈ All count, the predicate is wrong (or SM's data profile changed) — stop and re-derive per research.md D2.

## 4. Back-compat matrix (US3, contract normalization table)

Visit each URL manually and confirm the resulting view + resulting URL match `contracts/view-state-contract.md`:

- `/dashboard/inbox?segment=enquiries`
- `/dashboard/inbox?segment=enquiries&conversation=<id-from-SM-list>`
- `/dashboard/enquiry-triage` and `/dashboard/enquiry-triage?conversation=<id>` (router alias — router.tsx untouched)
- `/dashboard/inbox?segment=enquiries&view=all`
- `/dashboard/inbox?view=bogus`

localStorage cases (DevTools → Application → Local Storage):
- clear both keys → default customers;
- set only `inbox.desktop.viewMode.v1=conversations` → defaults to All, `inbox.desktop.view.v2` gets written, v1 left in place;
- set only `inbox.desktop.viewMode.v1=customers` → defaults to By customer;
- v2 present → v1 ignored.

## 5. Effect-remap regression pass (US-independent, the high-risk area)

Exercise each remapped behavior (inventory V1–V14/S1–S6 in research.md):

- **Auto-select** (V5): open All view → first conversation auto-selected; delete/filter it away → next auto-selected; in By customer view the conversation auto-select does NOT run.
- **Customers auto-select + auto-mark-read** (V6, V7): switch to By customer → first row selected, its unreads auto-marked read; mark a row unread → it stays unread (forced-unread guard).
- **Read/unread toggle** (V8–V10): works in all three views; in By customer it targets the row's conversations; multi-select clears after toggle in list views.
- **New conversation** (V11): create from All view → new conversation selected, channel filter follows; create from By customer → no auto-select (matches today).
- **Right pane** (V14, S5): list views + board → `ConversationView`; By customer → `CustomerConversationView`.
- **Create-order panel** (S6 + D7): select an order-less conversation in To triage → `EnquiryCreateOrderPanel` appears in the right column; also with board on; NOT in All view (unchanged from today's non-enquiries behavior).
- **Board** (S2, S4): with board on, pipeline query fires (network tab), columns render, mark-in-progress button present (do not click on real data).
- **Rail**: collapse left panel in By customer view → rail shows conversation avatars (known gap, unchanged); expand restores.
- **GHL tab**: switch source to GHL → identical to `staging`.
- **Mobile width**: narrow viewport — view switch reachable, no layout break.

## 6. Churchill smoke (read-only, optional)

Log into Churchill account: inbox loads, To triage shows empty state (not error), no console errors. Nothing else — 1 conversation total.
