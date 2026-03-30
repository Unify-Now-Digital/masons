# Inbox UI Refinement — Implementation Plan

## 1. Which parent/layout must be height-bound

**File:** `src/app/layout/DashboardLayout.tsx`

The **main** element that wraps `<Outlet />` (which renders UnifiedInboxPage on `/dashboard/inbox`) must be height-bound so that the Inbox content can fill remaining viewport height instead of growing the page.

**Current:**  
`<main className="flex-1 min-w-0 p-3 sm:p-6 bg-slate-50 overflow-x-hidden">`

**Change:**  
Add `min-h-0 overflow-hidden flex flex-col` so that:
- `min-h-0` allows the flex child to shrink and receive a bounded height from the layout.
- `overflow-hidden` prevents main from scrolling and keeps overflow inside the Outlet.
- `flex flex-col` makes main a flex container so the Outlet child can use `flex-1 min-h-0` to fill remaining height.

**Resulting main:**  
`<main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-3 sm:p-6 bg-slate-50">`

**Note:** Other dashboard routes (Orders, Customers, etc.) are also rendered inside this main. Their page roots should use `flex-1 min-h-0 overflow-auto` (or similar) so they fill main and scroll inside it, preserving document-style scroll for those pages. Only layout/CSS changes; no route-specific logic required if each page root is a single scrollable block.

---

## 2. Exact flex/grid chain from page root to each scroll region

### Chain (top to bottom)

1. **DashboardLayout root**  
   `min-h-screen flex flex-col`  
   → header `h-14 shrink-0`, main `flex-1 min-h-0 flex flex-col overflow-hidden`.

2. **Main**  
   → Outlet (UnifiedInboxPage) as single child.  
   UnifiedInboxPage **root** must be:  
   `flex flex-col flex-1 min-h-0 overflow-hidden`.

3. **UnifiedInboxPage root**  
   - Header block (title + actions): `shrink-0`.  
   - Grid wrapper: `flex-1 min-h-0 min-w-0 overflow-hidden` (takes remaining height).

4. **Grid wrapper**  
   Single child: the three-column **grid**.  
   Grid: `h-full min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_340px]`  
   so the grid fills the wrapper height.

5. **Each column** (left, center, right)  
   - Wrapper div: `flex flex-col min-h-0 overflow-hidden` (and for left/right, existing classes like `h-full` or column-specific layout).  
   - So each column is a flex column with a bounded height and no overflow leak.

6. **Left column**  
   - InboxConversationList root: already `h-full min-h-0 flex flex-col overflow-hidden`.  
   - Toolbar (filters + channel + search): `shrink-0`.  
   - List container: `flex-1 min-h-0 overflow-auto` → **scroll region**.

7. **Center column**  
   - Wrapper: `flex flex-col min-h-0 overflow-hidden`.  
   - ConversationView root: `h-full flex flex-col min-h-0 overflow-hidden`.  
   - ConversationHeader: `shrink-0`.  
   - ConversationThread root: `flex-1 flex flex-col min-h-0 overflow-hidden`.  
   - Thread message area: `flex-1 min-h-0 overflow-auto` → **scroll region**.  
   - Composer block: `shrink-0`.

8. **Right column**  
   - Wrapper: `flex flex-col min-h-0 overflow-hidden`.  
   - PersonOrdersPanel: restructure so title is `shrink-0` and content (summary + list) sits in one scroll container: `flex-1 min-h-0 overflow-auto` → **scroll region**.

---

## 3. Center column: what scrolls vs what stays fixed

- **Fixed (shrink-0):**  
  - ConversationHeader (person name, order badge, secondary handle, link/change-link).  
  - Reply composer (Reply via, AI suggestion chip, textarea, Send button).

- **Scrolls:**  
  - Only the **message thread** (the list of message bubbles). The element that wraps the message list must have `flex-1 min-h-0 overflow-auto` so it fills the space between header and composer and scrolls when there are many messages.

---

## 4. How the composer stays pinned at the bottom

- The **center column** gets a fixed height from the chain: DashboardLayout main → UnifiedInboxPage root (flex-1 min-h-0) → grid wrapper (flex-1 min-h-0) → grid (h-full) → center column (flex, min-h-0 overflow-hidden).
- The center column is a flex column with three logical parts: header (shrink-0), thread (flex-1 min-h-0 overflow-auto), composer (shrink-0).
- So the composer is the last flex child with `shrink-0` and stays at the bottom of the center column; the thread in the middle is the only area that scrolls. No viewport/position sticky needed.

---

## 5. Left conversation list scroll region

- Left column wrapper in UnifiedInboxPage: `flex flex-col min-h-0 overflow-hidden` (and any existing classes).  
- InboxConversationList root: `h-full min-h-0 flex flex-col overflow-hidden`.  
- Toolbar (filter buttons + channel Select + search Input): all `shrink-0`.  
- Single scrollable block: one div with `flex-1 min-h-0 overflow-auto` wrapping the list of conversation rows.  
- That div is the only scroll region in the left column; the list already uses this pattern, so the fix is ensuring the page and grid give the left column a bounded height (via the chain above).

---

## 6. Right order context panel scroll region

- Right column wrapper: `flex flex-col min-h-0 overflow-hidden`.  
- PersonOrdersPanel must be structured as a flex column that **fills** the right column: root `h-full flex flex-col min-h-0 overflow-hidden`.  
- Title block (“Order context (N)”): `shrink-0`.  
- One scroll container: `flex-1 min-h-0 overflow-auto` wrapping **both** the OrderContextSummary and the order list (so summary + list scroll together), or summary `shrink-0` and a second div `flex-1 min-h-0 overflow-auto` for the list only. Prefer one scroll region (summary + list) for a simpler panel.  
- That scroll container is the right column’s only scroll region.

---

## 7. Reducing “card-heavy” feel

**Left (InboxConversationList):**
- Replace each conversation row’s `<Card>` + `<CardHeader>` with a simple row: a `<button>` or `<div>` with `border-b`, small padding (`py-2 px-3`), no or minimal `rounded`, and a light background on hover/selected. Keep checkbox, icon, person name, preview, timestamp, and badges; only change wrapper and styles so it reads as a list row, not a card.
- In UnifiedInboxPage, left column wrapper: use `border-r bg-muted/30` (or similar) and drop `rounded-lg` for a clearer sidebar look.

**Right (PersonOrdersPanel / OrderContextSummary):**
- PersonOrdersPanel: avoid a heavy Card wrapper; use a simple panel container with `border-l` or subtle background and padding. CardTitle → a plain heading with smaller type.
- OrderContextSummary: replace heavy card styling with a light container (e.g. `rounded-md border bg-muted/20 p-3`); keep content, reduce shadow and border weight.
- Order list rows: keep as buttons/list items with hover state; ensure spacing and typography feel consistent with a side panel.

---

## 8. Center header / thread / composer spacing (mockup-aligned)

- **ConversationHeader:** Slightly reduce padding (e.g. `px-3 py-2`), ensure order badge and link controls are aligned; optional small typography tweaks so hierarchy matches the mockup.
- **Thread:** Message scroll container: keep `space-y-4` or use `space-y-3`; ensure the scroll div has `flex-1 min-h-0 overflow-auto` and optional padding (e.g. `px-3 py-2`).
- **Composer:** Keep “Reply via” and channel Select; use lighter styling (e.g. smaller label, integrated Select). AI suggestion chip: compact, above textarea, no yellow banner. Composer block: `border-t pt-4 pb-3 px-3` (or similar) and `shrink-0`.

---

## 9. Risks to conversation / reply / order behavior

- **No state or data logic changes:** Only container elements and classNames are changed. All existing props, hooks, and handlers (conversation selection, message load, send reply, AI suggestion, person link, archive, mark unread, order list, order popout) stay as-is.
- **Risks:**  
  - Over-aggressive `overflow-hidden` could clip content: ensure only the intended scroll containers have `overflow-auto` and the rest `overflow-hidden`.  
  - Removing or changing a wrapper that has an `onClick` could break selection: do not remove or change the clickable element for conversation rows or order rows; only replace Card with a different wrapper (e.g. button) that still receives the same handlers.  
  - Other dashboard pages: giving main `min-h-0 overflow-hidden flex flex-col` means the Outlet always gets a bounded height. Pages that expect to grow the page (e.g. long tables) should have a root like `flex-1 min-h-0 overflow-auto` so they fill main and scroll inside it; that preserves “one scroll” behavior. If any page currently assumes main scrolls, verify after the layout change.

---

## 10. Exact files to change

| File | Purpose |
|------|--------|
| `src/app/layout/DashboardLayout.tsx` | Add `min-h-0 overflow-hidden flex flex-col` to main so Inbox (and other routes) can fill height and scroll internally. |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Root: `flex flex-col flex-1 min-h-0 overflow-hidden`. Header block: `shrink-0`. Grid wrapper: `flex-1 min-h-0 min-w-0 overflow-hidden`. Grid: `h-full min-h-0`. Left column wrapper: `flex flex-col min-h-0 overflow-hidden` + sidebar styling. Center column wrapper: `flex flex-col min-h-0 overflow-hidden`. Right column: already `flex flex-col min-h-0 overflow-hidden`; keep. |
| `src/modules/inbox/components/InboxConversationList.tsx` | Toolbar and search: ensure `shrink-0`. List container: keep `flex-1 min-h-0 overflow-auto`. Replace Card-based conversation rows with lightweight list rows (e.g. button with border-b, compact padding). |
| `src/modules/inbox/components/ConversationView.tsx` | Root: keep `h-full flex flex-col min-h-0 overflow-hidden`. ConversationHeader: ensure it is not flex-1 (implicit shrink-0 or add `shrink-0`). ConversationThread wrapper: ensure it can grow (flex-1 min-h-0 overflow-hidden). Empty state (no conversation): use a container that fills height without breaking the flex chain. |
| `src/modules/inbox/components/ConversationThread.tsx` | Message list wrapper: `flex-1 min-h-0 overflow-auto` (add `min-h-0` if missing). Composer wrapper: `shrink-0`. Optional: refine composer and “Reply via” spacing/styling. |
| `src/modules/inbox/components/ConversationHeader.tsx` | Optional: adjust padding/typography to match mockup. |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` | Root: `h-full flex flex-col min-h-0 overflow-hidden` (replace outer Card with a div or a lighter panel structure). Title: `shrink-0`. Content: one wrapper with `flex-1 min-h-0 overflow-auto` containing summary + order list (or summary shrink-0 and list `flex-1 min-h-0 overflow-auto`). Empty/loading/error states: keep inside the same flex structure. |
| `src/modules/inbox/components/OrderContextSummary.tsx` | Lighter container styling (e.g. subtle border and bg), spacing and typography for side-panel look. |

No backend, API, or data-layer changes.
