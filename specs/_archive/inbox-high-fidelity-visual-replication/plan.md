# High-Fidelity Inbox Visual Replication — Implementation Plan

## 1. Which components need a true visual rewrite vs light restyling

**True visual rewrite (rebuild markup and layout):**
- **InboxConversationList:** Conversation row structure (avatar pill, name, metadata line, preview, status badges, timestamp); filter bar (pills); channel control. Checkbox minimized or moved but behavior kept.
- **ConversationHeader:** Layout and typography (larger name, subtle order badge, secondary line, link controls). Same props and callbacks.
- **ConversationThread (composer only):** Reply channel as segmented pills; textarea and Send button restyled; AI suggestion chip restyled. Message list: same structure, new bubble styling (can be restyle if structure already supports it).
- **PersonOrdersPanel:** Title style, section labels (Workflow / Financial), summary block layout, order list row appearance. Same data and click behavior.
- **OrderContextSummary:** Summary block layout and typography to match target; only existing Order fields.

**Light restyling (keep markup, change classes):**
- Message bubbles in ConversationThread (colors, borders, spacing).
- Order list row buttons in PersonOrdersPanel (spacing, typography, hover).
- UnifiedInboxPage: column widths, optional header spacing; no layout-structure change.
- Archive / Mark unread: optional class changes to fit new language.

---

## 2. How to rebuild the left conversation row structure to match the target

**Target row structure (left to right, top to bottom):**
1. **Avatar/initial pill** — Left side, square or rounded pill with 2-letter initials (or “?”). Optional status dot (e.g. red for urgent).
2. **Primary line** — Bold person/customer name (or primary_handle).
3. **Metadata line** — Channel label (Email / WhatsApp / SMS) and optionally order ID if we have it without N+1; otherwise omit order ID from list.
4. **Preview line** — Last message preview, muted, single line truncate.
5. **Status badges** — URGENT (red), UNLINKED (purple), ACTION REQUIRED (olive), plus channel badge; mockup-like pill shape.
6. **Timestamp** — Right-aligned, small muted text.

**Implementation:**
- One row = one clickable container (button or div with role="button") that calls `onSelectConversation(conversation.id)`. Selected state: subtle background (e.g. `bg-emerald-50` or light green tint).
- **Layout:** Flex or grid: `[avatar pill] [content block] [timestamp]`. Content block: stack (name, metadata, preview, badges). Checkbox: inside the row but small and low-contrast (e.g. absolute top-left or first cell with `opacity-60`/small size); same `onToggleSelection`, `selectedItems`.
- **Initials:** From `personNameMap.get(conversation.person_id)` or `conversation.primary_handle`; derive two letters (e.g. first two chars of name, or first letter of first two words). Unlinked: “?” or first two of primary_handle.
- **Order ID in list:** Omit unless we can derive from existing list data without extra fetch; keep order in center header and right panel only if N+1 is a concern.

---

## 3. Avatar/initial pills and reducing checkbox-heavy feel without breaking selection

**Avatar/initial pill:**
- New presentational component `InboxAvatarPill`: props `initials: string`, optional `statusDot?: 'urgent' | 'unlinked' | null`. Renders a small square or rounded rectangle (e.g. 32×32px) with centered initials; if `statusDot`, render a small colored dot (e.g. top-right). Use mockup-aligned bg (e.g. `bg-emerald-700 text-white` for default; or neutral for unlinked).
- Use in each conversation row; initials from person name or primary_handle as above.

**Checkboxes:**
- Keep one checkbox per row in the DOM; same `checked={selectedItems.includes(conversation.id)}`, `onChange={() => onToggleSelection(conversation.id)}`, `onClick={(e) => e.stopPropagation()}`.
- **Minimize visually:** Smaller size (e.g. `h-3.5 w-3.5`), lower opacity when unchecked (e.g. `opacity-50`), or show only when row is hovered/focused (e.g. `opacity-0 group-hover:opacity-100`). Ensure it remains focusable and usable for keyboard and a11y.
- Do not remove multi-select or archive/mark-unread behavior; only change appearance and placement so the row looks closer to the target (e.g. checkbox at start of row but subtle).

---

## 4. Filter pills and channel control to match the mockup

**Filter pills:**
- Replace the current filter button group with a row of pill-shaped elements (no heavy border group). Each pill: rounded-full or rounded-lg, padding (e.g. `px-3 py-1.5`), text-sm.
- **Selected:** `bg-emerald-700 text-white` (or design-system dark green). **Unselected:** `bg-slate-100 text-slate-700` or `bg-muted/50 text-muted-foreground`.
- Same labels: All, Unread, Urgent, Unlinked. Same `listFilter` state and `onListFilterChange(value)`.
- Optional: small presentational component `InboxFilterPill` for consistency.

**Channel selector:**
- **Option A (pill group):** “Channel” or “All” label + [All] [Email] [SMS] [WhatsApp] as pills; selected = dark green, unselected = light grey. Same `channelFilter`, `onChannelFilterChange`.
- **Option B:** Compact dropdown with restyled trigger (smaller, lighter border) and same options. Prefer pills if it matches the mockup more closely.
- Preserve behavior: `channelFilter` drives `filters.channel` in `useConversationsList(filters)`.

---

## 5. Center header and conversation thread restyle/restructure

**Header (ConversationHeader):**
- **Name:** Larger (e.g. `text-lg font-semibold`), dark text.
- **Order badge:** Subtle (e.g. `bg-emerald-100 text-emerald-800` or `bg-emerald-50 text-emerald-700`), small, rounded. Same `orderDisplayId` prop.
- **Secondary line:** Subject or “Re: …” and/or handle (email/phone); smaller, muted. Same `secondaryLine` prop.
- **Link state:** “Linked” / “Not linked” as small badge; “Change link” / “Link person” as small button or text link. Same `linkStateLabel`, `actionButtonLabel`, `onActionClick`.
- **Layout:** Optional: move link controls to a second row or right group to match mockup; keep all elements and behavior.

**Thread (ConversationThread):**
- **Bubbles:** Incoming = white or very light grey bg, subtle border, `rounded-lg`. Outgoing = light green (e.g. `bg-emerald-50` or `bg-green-50`), subtle border, `rounded-lg`. Consistent padding and spacing between bubbles (e.g. `space-y-3`).
- **Inside each bubble:** Sender name + small channel icon + timestamp on one line (small, muted); message body below. Preserve existing message data and scroll ref; only change wrapper classes and inner text styles.
- **AI suggestion:** Restyle the chip (e.g. light border, neutral or soft green tint, smaller text); same `useSuggestedReply` and `onUseSuggestion` (insert into composer). No yellow banner.

---

## 6. Composer and reply channel controls

**Reply channel:**
- Replace the `<Select>` with inline segmented control: label “Reply via” + a row of pills [Email] [WhatsApp] [SMS]. Only show channels that are available (e.g. from `availableChannels` or conversation context). Selected = dark green bg; unselected = light grey. Same state: `selectedChannel`, `setSelectedChannel`; when `channelLocked` (replyTo set), keep selected channel and disable switching. Preserve `effectiveChannel` and send logic.
- Small component `ReplyChannelPills` (or inline in ConversationThread): `channels`, `value`, `onChange`, `disabled`.

**Composer:**
- Textarea: lighter border (e.g. `border-slate-200`), padding (e.g. `p-3`), placeholder “Type your reply…”.
- Send button: dark green (e.g. `bg-emerald-700 hover:bg-emerald-800`), white text, rounded. Same `handleSendReply`, `replyText`, `setReplyText`, disabled logic.
- Optional: “Attach” and “Quick” reply pills below only if they already exist in the app; style to match. Do not add new behavior.

---

## 7. Right order context panel: title, summary, section labels, order list

**Title:**
- “Order context” or “ORDER CONTEXT” with uppercase/tracked typography (e.g. `text-xs font-semibold tracking-wider text-slate-600`). Optional “×” icon (no-op or future close). Same panel behavior (no removal).

**Summary block (OrderContextSummary):**
- Order ID prominent (e.g. `font-semibold text-slate-900`). Customer name, location, order type below in smaller muted text. Status badges (stone, permit, proof) in a row with mockup colors. Use only existing `Order` fields. Container: light border, soft background (e.g. `bg-slate-50` or `bg-muted/20`), `rounded-md`, padding.

**Section labels:**
- Add “Workflow” (or “WORKFLOW GATES”) above the status badges / workflow-related fields (permit_status, stone_status, proof_status). Add “Financial” (or “FINANCIAL”) above value/deposit if we show them. Use existing data only; no fake sections. Typography: small, uppercase or title case, muted.

**Order list:**
- Each row: order ID (bold), type/description, amount; spacing and typography to match target. Same `onSelectOrder`, `onOpenOrderDetails`; selected row highlighted. Preserve scroll region and empty/loading/error states.

**Actions section:**
- Do not implement; leave space or a placeholder structure so it can be added later without layout shift.

---

## 8. Exact files to change

| File | Change |
|------|--------|
| **UnifiedInboxPage.tsx** | Column widths (e.g. grid-cols) to match mockup proportions; optional header (title, Archive, Mark unread) spacing/typography. No layout-structure or state changes. |
| **InboxConversationList.tsx** | Rebuild row: InboxAvatarPill, name, metadata, preview, InboxStatusBadge(s), timestamp; minimize checkbox. Rebuild filter bar with InboxFilterPill or equivalent pills. Restyle or replace channel selector. Apply new tokens (emerald, slate, status colors). Preserve all props and callbacks. |
| **ConversationHeader.tsx** | Rebuild layout: larger name, subtle order badge, secondary line, link badge + button. New classes; same props and `onActionClick`. |
| **ConversationThread.tsx** | Restyle message bubbles (incoming/outgoing colors, spacing). Restyle AI suggestion chip. Replace reply channel Select with ReplyChannelPills; restyle textarea and Send button. Preserve scroll ref, message list, send logic, channel state, AI suggestion behavior. |
| **PersonOrdersPanel.tsx** | New title style; section labels (Workflow, Financial) above existing content; restyle summary + list container and order rows. Preserve `useOrdersByPersonId`, selection, `onOpenOrderDetails`, empty/loading/error. |
| **OrderContextSummary.tsx** | Rebuild summary layout and typography (order ID, customer, location, type, status badges); only existing Order fields. |
| **New: InboxAvatarPill.tsx** | Presentational: initials + optional status dot; used in list rows. |
| **New: InboxFilterPill.tsx** (optional) | Presentational: single filter pill (label, selected, onClick). |
| **New: InboxStatusBadge.tsx** (optional) | Presentational: urgent / unlinked / action / channel variants with mockup colors. |
| **New: ReplyChannelPills.tsx** (optional) | Presentational: segmented control for Email/WhatsApp/SMS; value, onChange, disabled. |

---

## 9. Small presentational subcomponents to add

- **InboxAvatarPill** — `initials: string`, `statusDot?: 'urgent' | 'unlinked' | null`. Renders pill + optional dot. Used in InboxConversationList rows.
- **InboxFilterPill** — `label: string`, `selected: boolean`, `onClick: () => void`. Used for All/Unread/Urgent/Unlinked.
- **InboxStatusBadge** — `variant: 'urgent' | 'unlinked' | 'action' | 'channel'`, `children`. Applies red/purple/olive/neutral so list and header badges are consistent.
- **ReplyChannelPills** — `channels: ('email'|'sms'|'whatsapp')[]`, `value: string`, `onChange: (v) => void`, `disabled?: boolean`. Used in ConversationThread composer.

Place under `src/modules/inbox/components/` (e.g. `inbox/` subfolder or same folder). No logic beyond presentation and forwarding callbacks.

---

## 10. Token and fidelity priorities

- Do not preserve current visual tokens if they keep the page looking like the old app. Override with explicit Tailwind classes for this route: e.g. `emerald-700` for primary/selected, `emerald-100`/`emerald-50` for light fills, `red-600` for URGENT, `violet-500` for UNLINKED, `amber-600` for ACTION REQUIRED, `slate-100`/`slate-200` for neutrals.
- Preserve all behavior (selection, send, AI suggestion, linking, archive, mark unread, order popout, multi-select, full-height scroll). Prioritize visual fidelity to the target mockup within those constraints.
