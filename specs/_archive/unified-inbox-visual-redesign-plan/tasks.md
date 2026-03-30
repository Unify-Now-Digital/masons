# Tasks: Unified Inbox Visual Redesign

## Phase 0: Page and panel surfaces

### 0.1 UnifiedInboxPage — page background and panel wrappers

- **File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **Changes (markup/classNames only):**
  - Wrap main content (below page title and search) in a container with `bg-muted/30` (page background).
  - Wrap the four-column grid in a container that does not remove existing `min-h-0 min-w-0 overflow-hidden` from column divs.
  - Add panel surface to each column wrapper: `bg-background border border-border/60 rounded-xl shadow-sm` plus existing flex/grid/overflow classes. Ensure **column 1 (People), column 2 (Conversation area), column 3 (Orders)** each get the panel surface; the inner “Conversations list” and “Conversation panel” areas may be sub-panels or share the same surface as the middle column.
- **Preserve:** All `min-h-0`, `min-w-0`, `overflow-hidden`, `overflow-auto` on grid and column divs (scroll guard).
- **Do not change:** State, effects, query keys, handlers, or child component props (except where a wrapper div is added for styling).

### 0.2 People panel surface

- **File:** `src/modules/inbox/components/PeopleSidebar.tsx`
- **Changes:** Apply panel surface to the root container(s): `bg-background border border-border/60 rounded-xl shadow-sm` (or inherit from parent if UnifiedInboxPage wraps the column). If the column wrapper in UnifiedInboxPage already provides the surface, ensure PeopleSidebar root does not double border; alternatively give PeopleSidebar root the panel classes and ensure parent column has padding. Keep **collapsed** and **expanded** behavior and all `overflow-y-auto` / flex structure unchanged.
- **Preserve:** `flex-1 overflow-y-auto`, collapsible logic, search, selection state.

---

## Phase 1: Tabs and conversation list

### 1.1 Tabs — pill style

- **File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **Changes:** Style `TabsList` and `TabsTrigger` for pill style: e.g. `TabsList` with `rounded-full` and appropriate padding/gap; `TabsTrigger` with `rounded-full` when active. Keep `value`/`onValueChange` and tab values (`all`, `email`, `sms`, `whatsapp`) unchanged.
- **Do not change:** `activeTab` state or `filters` derivation.

### 1.2 Conversation list — active row and panel

- **File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **Changes:** Update the conversation `Card` (or list row) styling: active row `bg-muted/60` and left border accent `border-l-4 border-primary` (or `border-l-2 border-primary`). Inactive row: no left accent, hover e.g. `hover:bg-muted/30`. Ensure the scrollable list container keeps `flex-1 min-h-0 overflow-auto`.
- **Preserve:** `onClick`, checkbox, `selectedConversationId`, `selectedItems`, conversation data rendering.

---

## Phase 2: Conversation header

### 2.1 ConversationHeader — layout and styling

- **File:** `src/modules/inbox/components/ConversationHeader.tsx`
- **Changes:** Refine layout to match “avatar + title + subline + actions” clearly: keep Avatar, displayName (title), secondaryLine (subline), Badge, and action Button; adjust spacing and typography (e.g. title font-medium, subline text-muted-foreground). Optionally add a small gap between name block and actions. Ensure sticky and border-b remain so the header does not scroll away. No prop or behavior changes.
- **Do not change:** Props, `onActionClick`, or any logic.

---

## Phase 3: ConversationThread — composer dock and suggestion chip

### 3.1 ConversationThread — card and scroll container

- **File:** `src/modules/inbox/components/ConversationThread.tsx`
- **Changes:**
  - **Card:** Apply panel surface if not coming from parent: `rounded-xl border border-border/60 shadow-sm`. Keep `flex-1 flex flex-col min-w-0 min-h-0` on Card; keep CardContent `flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden`.
  - **Scroll container (critical):** The div with `ref={scrollContainerRef}` must keep `flex-1 min-w-0 overflow-y-auto overflow-x-hidden` (and any `min-h-0` on parent) so scroll guard and auto-read continue to work. Do not remove or change `ref={scrollContainerRef}`.
- **Preserve:** All refs, state, and message list rendering.

### 3.2 Composer as sticky dock; suggestion chip in composer header

- **File:** `src/modules/inbox/components/ConversationThread.tsx`
- **Changes:**
  - Wrap the composer block (the `div` with `ref={composerRef}`) so it is a **sticky dock** at the bottom: e.g. `sticky bottom-0` and a background (e.g. `bg-background border-t`) so it stays visible when the message list scrolls. Ensure the parent of the scroll container and the composer is still a flex column with `min-h-0 overflow-hidden` so the scroll area shrinks correctly.
  - **Suggestion chip:** Move the suggestion chip into the **composer header row**: same horizontal row as “Replying to” (if present) and/or channel select, so the chip is part of the dock’s top row rather than floating above the textarea. Keep loading/error and click-to-set-reply behavior.
  - Composer area: consistent padding, optional rounded top corners for the dock strip. Keep Textarea, Send button, replyTo, and channel select behavior unchanged.
- **Preserve:** `composerRef`, `textareaRef`, `setReplyText`, `handleSendReply`, all props and hooks (useSuggestedReply, useSendReply, etc.).

---

## Phase 4: Orders panel dark header

### 4.1 PersonOrdersPanel — dark header with count badge

- **File:** `src/modules/inbox/components/PersonOrdersPanel.tsx`
- **Changes:**
  - Replace or restyle the current `CardHeader` (Orders + count) with a **dark accent header block**: `bg-slate-900 text-white` (e.g. a div or CardHeader with those classes), title “Orders” and a count badge (e.g. “3” or “Orders (3)”) in the same header. Rest of panel (order list, detail) keeps light background; ensure panel surface (e.g. rounded-xl, border) wraps the whole card.
- **Preserve:** `useOrdersByPersonId`, `useOrder`, order list click, `OrderDetailsSidebar`, and all props.

---

## Phase 5: Consistency and QA

### 5.1 ConversationView — container

- **File:** `src/modules/inbox/components/ConversationView.tsx`
- **Changes:** If the conversation column wrapper in UnifiedInboxPage already has the panel surface, ensure ConversationView root does not break layout. Root should keep `h-full flex flex-col min-h-0 min-w-0 overflow-hidden` so the ConversationThread scroll and dock work. Add or align panel surface only if needed (e.g. rounded corners for the conversation card).
- **Preserve:** `conversationId`, conversation/person data, ConversationHeader and ConversationThread props, `messagesContainerRef` (if still used), link modal.

### 5.2 AllMessagesTimeline (All tab)

- **File:** `src/modules/inbox/components/AllMessagesTimeline.tsx`
- **Changes:** If it renders full-width in the middle column, apply the same panel surface (rounded-xl, border, shadow-sm) so the All tab view matches the rest. Preserve `min-h-0 overflow-auto` and any internal scroll containers.
- **Preserve:** Person timeline logic, onOpenThread, and any refs.

---

## Elements that must retain min-h-0 / overflow (scroll guard)

- **UnifiedInboxPage:** Grid column wrappers: `min-h-0 min-w-0 overflow-hidden`; conversation list scroll area: `flex-1 min-h-0 overflow-auto`.
- **ConversationView:** Root: `min-h-0 min-w-0 overflow-hidden`.
- **ConversationThread:** Card and CardContent: `min-h-0 overflow-hidden`; **message list div (ref=scrollContainerRef):** `flex-1 min-w-0 overflow-y-auto overflow-x-hidden` — do not change.
- **PeopleSidebar:** Internal scroll containers: keep `overflow-y-auto` / flex-1.
- **PersonOrdersPanel:** Internal scroll areas: keep `overflow-y-auto` / max-h as-is.

---

## QA checklist (no regressions)

- [ ] **Scroll:** Message list in ConversationThread scrolls when there are many messages; scroll position is stable.
- [ ] **Auto-read:** Opening a conversation with unread messages still marks it as read (no change to effect or mutation).
- [ ] **Realtime:** New messages or conversation updates still appear (subscription and query invalidation unchanged).
- [ ] **Four columns:** People | Conversations | Conversation | Orders on large screen; layout does not break on smaller widths (existing breakpoints).
- [ ] **People collapse:** Collapse/expand People sidebar still works; selection state unchanged.
- [ ] **Tabs:** Switching All / Email / SMS / WhatsApp still filters conversations; no duplicate requests or wrong data.
- [ ] **Composer:** Reply, channel select, reply-to, suggestion chip click, and send still work; focus and refs intact.
- [ ] **Orders:** Selecting a person shows orders; selecting an order shows detail; no new errors in console.
