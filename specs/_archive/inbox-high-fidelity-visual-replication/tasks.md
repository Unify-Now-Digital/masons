# High-Fidelity Inbox Visual Replication — Tasks

## Phase 0: Design tokens and presentational components

- [X] **0.1** Add `InboxAvatarPill` component: props `initials: string`, optional `statusDot?: 'urgent' | 'unlinked' | null`. Render square/rounded pill (e.g. 32×32) with centered initials; mockup-aligned bg (e.g. emerald or neutral). Optional colored dot overlay. File: `src/modules/inbox/components/InboxAvatarPill.tsx`.
- [X] **0.2** Add `InboxFilterPill` component: props `label: string`, `selected: boolean`, `onClick: () => void`. Selected = dark green bg + white text; unselected = light grey. File: `src/modules/inbox/components/InboxFilterPill.tsx`.
- [X] **0.3** Add `InboxStatusBadge` component: props `variant: 'urgent' | 'unlinked' | 'action' | 'channel'`, `children`. Apply mockup colors (red, violet, amber/olive, neutral). File: `src/modules/inbox/components/InboxStatusBadge.tsx`.
- [X] **0.4** Add `ReplyChannelPills` component: props `channels: ('email'|'sms'|'whatsapp')[]`, `value: string`, `onChange: (v: string) => void`, `disabled?: boolean`. Segmented pill row; selected = dark green. File: `src/modules/inbox/components/ReplyChannelPills.tsx`.

## Phase 1: Left sidebar (InboxConversationList)

- [X] **1.1** Replace filter bar: use pill-shaped controls (InboxFilterPill or equivalent). Selected = `bg-emerald-700 text-white`; unselected = `bg-slate-100 text-slate-700`. Same `listFilter` / `onListFilterChange`. Labels: All, Unread, Urgent, Unlinked.
- [X] **1.2** Restyle or replace channel selector: either pill group (All | Email | SMS | WhatsApp) with same selected/unselected styling, or compact restyled Select. Preserve `channelFilter` / `onChannelFilterChange`.
- [X] **1.3** Rebuild conversation row layout: left = InboxAvatarPill (initials from person name or primary_handle; statusDot for urgent/unlinked if desired), then content block (primary line = bold name, metadata line = channel [+ order ID if available], preview line, status badges via InboxStatusBadge), right = timestamp. Same row click → `onSelectConversation(conversation.id)`; selected state = light green tint (e.g. `bg-emerald-50`).
- [X] **1.4** Minimize checkbox: keep in DOM with same `selectedItems` / `onToggleSelection`; make smaller and lower-contrast (e.g. smaller size, opacity when unchecked) or show on hover. Ensure a11y and keyboard usage.
- [X] **1.5** Apply mockup-aligned tokens across the list (emerald for selected states, slate for neutrals, red/violet/amber for status badges). Adjust sidebar padding/width if needed to match target proportions.

## Phase 2: Center column — header and thread

- [X] **2.1** Rebuild ConversationHeader: larger name (`text-lg font-semibold`), subtle order badge (`bg-emerald-100 text-emerald-800` or similar), cleaner secondary line (muted, smaller). Link state badge and Link/Change-link button styled to match mockup. Same props and `onActionClick`.
- [X] **2.2** Restyle message bubbles in ConversationThread: incoming = white/light grey bg, subtle border, `rounded-lg`; outgoing = light green (`bg-emerald-50` or similar), same border/radius. Sender + channel icon + timestamp on one line (small, muted). Preserve message data and scroll ref.
- [X] **2.3** Restyle AI suggestion chip in ConversationThread: new look (e.g. light border, soft fill) to match target; preserve `useSuggestedReply` and insert-into-composer behavior.
- [ ] **2.4** Replace reply channel Select with ReplyChannelPills in ConversationThread: "Reply via" + [Email] [WhatsApp] [SMS]. Preserve `selectedChannel`, `setSelectedChannel`, `channelLocked`, and send logic.
- [X] **2.5** Restyle composer: textarea (lighter border, padding); Send button (dark green `bg-emerald-700`). Same `handleSendReply`, `replyText`, disabled logic. Optional: style existing Attach/Quick pills if present.

## Phase 3: Right sidebar (PersonOrdersPanel + OrderContextSummary)

- [X] **3.1** PersonOrdersPanel: restyle title to match target ("Order context" or "ORDER CONTEXT" with tracked/small caps). Optional "×" if we have close behavior; otherwise leave structure for future.
- [X] **3.2** Add section labels in PersonOrdersPanel: "Workflow" (or "WORKFLOW GATES") above workflow-related content; "Financial" (or "FINANCIAL") above value/deposit if shown. Map only existing Order fields; no fake data.
- [X] **3.3** OrderContextSummary: rebuild summary block layout — order ID prominent, customer/location/type below; status badges in a row with InboxStatusBadge or mockup colors. Container: light border, soft bg, `rounded-md`. Use only existing Order fields.
- [ ] **3.4** Restyle order list rows in PersonOrdersPanel: spacing, typography, hover/selected state to match target. Preserve `onSelectOrder`, `onOpenOrderDetails`, click → OrderDetailsSidebar.
- [X] **3.5** Leave space/structure for future Actions section; do not implement actions in this pass.

## Phase 4: Page-level and polish

- [X] **4.1** UnifiedInboxPage: adjust column widths (grid breakpoints) to match mockup proportions if needed; optional header (title, Archive, Mark unread) spacing/typography. Do not change layout structure or state/handlers.
- [X] **4.2** Sweep: replace remaining default primary/muted tokens in inbox components with mockup-aligned classes (emerald, slate, status colors) where they still make the page look like the old app.
- [X] **4.3** Verify: conversation selection, message load, send reply, AI suggestion, person link/change link, archive, mark unread, order context load, order row click → OrderDetailsSidebar, multi-select with checkboxes, full-height and independent scrolling — all unchanged and working.

## Files to touch (summary)

| File | Phase |
|------|--------|
| `src/modules/inbox/components/InboxAvatarPill.tsx` (new) | 0.1 |
| `src/modules/inbox/components/InboxFilterPill.tsx` (new) | 0.2 |
| `src/modules/inbox/components/InboxStatusBadge.tsx` (new) | 0.3 |
| `src/modules/inbox/components/ReplyChannelPills.tsx` (new) | 0.4 |
| `src/modules/inbox/components/InboxConversationList.tsx` | 1.x |
| `src/modules/inbox/components/ConversationHeader.tsx` | 2.1 |
| `src/modules/inbox/components/ConversationThread.tsx` | 2.2–2.5 |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` | 3.1, 3.2, 3.4, 3.5 |
| `src/modules/inbox/components/OrderContextSummary.tsx` | 3.3 |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | 4.1 |
