# High-Fidelity Visual Replication Pass for Unified Inbox

## Overview

A focused UI replication pass so the Unified Inbox matches the provided target Claude mockup as closely as possible in appearance, while keeping the current 3-column architecture, full-height layout, independent scrolling, and all existing behavior. This is not a backend or data change; it is a high-fidelity visual restyle and structural adjustment of existing components.

**Context:**
- Previous passes fixed layout (3 columns, full-height, independent scroll regions) and reduced card-heavy styling, but the result still reads as the “old app” rather than the target design.
- The target mockup uses softer neutrals, lighter borders, clearer typography hierarchy, avatar/initial pills, segmented reply controls, and a distinct visual language. The current implementation still relies on default app tokens, old button/badge/card styling, and different spacing and proportions.
- Scope: Inbox page and its child components only. No API, schema, or hook changes.

**Goal:**
- **Primary:** Replicate the target mockup visually (colors, spacing, typography, row composition, buttons/chips/badges, header, thread bubbles, composer, right sidebar) so the Inbox feels like the target design, not the old app with minor tweaks.
- **Secondary:** Preserve conversation selection, message loading, send reply, AI suggestion, person linking, archive/mark unread, order context, order popout, and full-height independent scrolling. No removal or change of working functionality.

---

## Current State Analysis

### Visual / UI State (What Is Wrong)

**Overall:**
- Page still uses default app button styling, badge/chip styling, and border/card treatments, so it feels like the old app.
- Spacing and typography rhythm do not match the target; proportions and visual density differ.
- Column widths and internal proportions could better match the mockup.

**Left sidebar (InboxConversationList):**
- Conversation rows are button-based with checkbox + icon + text + badges; they do not match the target’s row composition (avatar/initial pill, bold name, metadata line, preview, status pills, timestamp).
- Checkboxes are prominent, giving a “checkbox list” feel; target mockup does not emphasize checkboxes (or omits them in the primary row design).
- Filter controls are small buttons in a bordered group; target uses pill-shaped filter pills with a selected state (e.g. dark green fill for “All”).
- Channel selector is a standard Select dropdown; target may use a more integrated control.
- Badges (unread, urgent, unlinked, channel) use current app variants; target uses specific colors/shapes (e.g. red “URGENT”, purple “UNLINKED”, olive “ACTION REQUIRED”).
- No avatar/initial pill on the left of each row; target shows square pills with initials and optional status dots.
- Order ID is not shown in list rows (data constraint noted in prior spec); target shows order ID in metadata where available—replicate in header/selected context only if list data does not support it.

**Center column:**
- **Header:** Name, order badge, and secondary line exist but typography, spacing, and control placement do not match the target (larger name treatment, subtler order badge, cleaner metadata, link controls placement). Archive/Mark unread are separate from the target’s “AI”, “Details”, “…” style controls but must remain functionally.
- **Thread:** Message bubbles use current borders and backgrounds; target has more rectangular bubbles, clearer left/right alignment, different spacing and whitespace. Sender/channel/timestamp styling differs.
- **AI suggestion:** Current chip styling does not match the target UI language; should be restyled to fit the mockup.
- **Composer:** Reply channel is a Select; target uses inline segmented/pill controls (“Reply via: Email | WhatsApp | SMS”). Textarea and Send button styling are generic; target has a clearer bottom toolbar feel and specific button style. Quick-reply pills below composer appear in the target; if we have them, style to match; if not, optional add for fidelity without changing core behavior.

**Right sidebar (PersonOrdersPanel, OrderContextSummary):**
- Title and summary block use current panel/card styling; target has distinct “ORDER CONTEXT” title style, summary block appearance, and section labels (e.g. “WORKFLOW GATES”, “FINANCIAL”).
- Order list rows are simple buttons; target has a specific row look and spacing.
- Typography hierarchy and spacing do not match the mockup. Actions section is out of scope for this pass but the panel should be structured so it can align visually with the mockup.

### Data and Behavior (Must Stay)

- **Data:** All content comes from existing APIs and state (conversations, messages, customers, orders). No new backend fields; order ID in list only if derivable from existing data without N+1.
- **Actions:** Conversation selection, message load, send reply, AI suggestion use/insert, person link/change link, archive, mark unread, order context load, order row click → OrderDetailsSidebar must continue to work. Checkboxes for multi-select (archive/mark read) must remain functional even if visually minimized or relocated.
- **Layout:** Full-height, three-column, independent scroll regions must be preserved.

---

## Target Visual Requirements (Replication Targets)

### 1. Overall Page Visual Language

- Softer neutral backgrounds and lighter borders; move away from heavy cards and default app tokens.
- More compact but deliberate spacing; typography hierarchy (size, weight, color) aligned with the mockup.
- Column widths and proportions adjusted to better match the target (e.g. left sidebar width, center vs right balance).
- Global use of mockup-aligned colors for primary actions (e.g. dark green for selected/primary), neutrals for text and borders, and status colors (red urgent, purple unlinked, etc.) where the mockup uses them.

### 2. Left Sidebar

- **Conversation rows:** Rebuild row layout to approximate the target:
  - **Avatar/initial pill** on the left (square or rounded pill with initials; optional status dot). Use person name or primary_handle to derive initials; “?” or default for unlinked/unknown.
  - **Primary line:** Bold person/customer name (or primary_handle).
  - **Metadata line:** Channel (e.g. “Email”, “WhatsApp”) and, if available without extra fetch, order ID (e.g. “ORD-1245”); otherwise omit from list and keep order in center header only.
  - **Preview:** Latest message preview, styled like the mockup.
  - **Status badges:** URGENT (red), UNLINKED (light purple), ACTION REQUIRED (olive) etc., with mockup-like shape and color.
  - **Timestamp:** Right-aligned, mockup styling.
- **Checkboxes:** Keep for multi-select but visually minimize (e.g. smaller, lower contrast) or relocate (e.g. show on hover/selection) so the row looks closer to the target; do not remove multi-select behavior.
- **Filter pills:** Replace current filter buttons with pill-shaped controls; selected state (e.g. “All”) with dark green background and white text; unselected with light grey background and dark text. Match target order and labels (All, Unread, Urgent, Unlinked; “Cemetery” only if in scope).
- **Channel selector:** Restyle to fit the target (e.g. compact dropdown or pill group). Preserve current filter behavior (All / Email / SMS / WhatsApp).
- **Top area:** If the target shows “Inbox” + “N new” and a “+ Compose” button, align title and any primary action visually; do not remove or change existing page header (Unified Inbox, Archive, Mark unread) without preserving their behavior.

### 3. Center Column

- **Header:**
  - Larger, bolder name/title treatment.
  - Order badge subtle, mockup-style (e.g. light green with dark text).
  - Secondary line (e.g. subject or “Re: …”) and handle (email/phone) with cleaner typography and spacing.
  - Link/change-link controls placed and styled to match the target; Archive and Mark unread can remain as they are or be restyled to fit (e.g. icon-only or grouped with “Details”/“…” if that fits the mockup without losing function).
- **Thread:**
  - Message bubbles: shape, padding, and alignment closer to the target (more rectangular, clear left/right, consistent spacing). Incoming vs outgoing colors and borders to match mockup (e.g. white vs light green).
  - Sender name, channel icon, and timestamp styled like the target; more deliberate whitespace between messages.
- **AI reply suggestion:** Restyle chip/block to match target UI language (no yellow banner); keep behavior (click to insert, above composer).
- **Composer:**
  - “Reply via” as inline segmented/pill controls (Email | WhatsApp | SMS) when multiple channels are available, preserving current channel state and send behavior; fallback to current Select if only one channel.
  - Textarea and Send button styled to match the target (border, padding, button color and shape).
  - Stronger “bottom toolbar” feel; optional “Attach” and “Quick” reply pills below if they exist in the app and can be styled without new behavior.

### 4. Right Sidebar

- **Title:** “ORDER CONTEXT” (or “Order context”) with mockup typography and optional close “x”; keep current panel behavior.
- **Summary block:** Restyle to match target (background, border, spacing, typography for order ID, customer, location, type).
- **Sections:** If the target uses labels like “WORKFLOW GATES” and “FINANCIAL”, structure the panel with similar section labels and spacing; map only existing fields (e.g. permit_status, stone_status, proof_status, value/deposit) to those sections. No fake data.
- **Order list:** Row appearance (spacing, typography, hover/selected) to match the target. Keep click → open OrderDetailsSidebar.
- **Actions section:** Do not implement in this pass if functionality is not ready; leave panel structure and spacing so it can be added later in a mockup-aligned way.

### 5. Preserve Behavior

- Conversation selection (click row → load thread).
- Message thread loading and display.
- Send reply (all channels).
- AI suggestion (fetch, display, insert into composer).
- Person linking / change link (modal and header controls).
- Archive and mark unread (bulk and single).
- Order context loading and display; order row click → OrderDetailsSidebar.
- Full-height layout and independent scrolling in all three columns.
- Multi-select with checkboxes for archive/mark read (even if checkboxes are minimized visually).

---

## Implementation Approach

### Phase 1: Design Tokens and Shared Styling

- Define or reuse Tailwind classes (or small CSS) for mockup-aligned colors (e.g. primary green, status red/purple/olive), borders, and typography scale for the Inbox. Apply consistently across the three columns so the whole page shares the new visual language.
- Optionally introduce small presentational subcomponents (e.g. `InboxAvatarPill`, `InboxFilterPill`, `InboxStatusBadge`) if they improve consistency and fidelity.

### Phase 2: Left Sidebar Rebuild

- Rebuild conversation row markup and layout in `InboxConversationList`: avatar pill, name, metadata, preview, badges, timestamp. Minimize or relocate checkboxes; keep `onToggleSelection` and selection state. Preserve `onSelectConversation(conversation.id)` and selected state styling.
- Restyle filter bar to pill-shaped controls with target selected/unselected states. Restyle channel selector. Preserve `listFilter`, `channelFilter`, and `useConversationsList(filters)` behavior.
- Adjust sidebar width and padding to match target proportions.

### Phase 3: Center Column Rebuild

- **ConversationHeader:** Rebuild layout and typography (name, order badge, secondary line, link controls); preserve `displayName`, `orderDisplayId`, `linkStateLabel`, `actionButtonLabel`, `onActionClick`. Archive/Mark unread stay on the page; header can reference or restyle as needed.
- **ConversationThread:** Restyle message bubbles (alignment, shape, colors, spacing); preserve message data, scroll ref, and read-only/editable behavior. Restyle AI suggestion chip; preserve `useSuggestedReply` and insert behavior.
- **Composer:** Replace or restyle reply channel control (segmented pills vs Select) while keeping `selectedChannel`, `setSelectedChannel`, and send logic. Restyle textarea and Send button; preserve `handleSendReply`, `replyText`, and channel-specific send.

### Phase 4: Right Sidebar Rebuild

- **PersonOrdersPanel:** Restyle container, title, and scroll region to match target; add section labels (e.g. “WORKFLOW GATES”, “FINANCIAL”) where existing data maps. Preserve `personId`, `selectedOrderId`, `onSelectOrder`, `onOpenOrderDetails`, and empty/loading/error states.
- **OrderContextSummary:** Rebuild summary block appearance (order ID, customer, location, type, status badges) to match target; use only existing `Order` fields. Preserve order list row click behavior.

### Phase 5: Integration and Polish

- Align column widths and page-level spacing with the mockup. Ensure no regressions in scrolling or focus/click targets. Verify all preserved behaviors end-to-end.

---

## What NOT to Do

- Do not change backend schema, API contracts, or data fetching logic.
- Do not invent or add fake data (e.g. placeholder “Actions” that do nothing).
- Do not remove working functionality (selection, send, AI suggestion, linking, archive, mark unread, order popout, multi-select).
- Do not break full-height layout or independent scroll regions.
- Do not add the full Actions section (View Full Order, Send Invoice, etc.) until functionality is ready; structure only so it can be added later.
- Do not refactor unrelated modules or introduce new state management for this pass.

---

## Unavoidable Deviations (Data / Scope)

- **Order ID in list rows:** If showing order ID per row would require N+1 or new API, keep order ID only in the center header (and right panel); list rows may omit it or show only when already available from existing data.
- **“Cemetery” filter:** Include in the filter bar only if it exists in the product scope and backend; otherwise match target with All, Unread, Urgent, Unlinked.
- **“+ Compose” and “N new”:** Replicate only if they already exist in the app or are in scope; otherwise align the existing “Unified Inbox” header and actions visually without adding new features.
- **Quick reply pills / Attach:** Style to match the target only if the app already has them; do not add new behavior in this pass.
- **Exact pixel/color values:** Match the mockup as closely as possible with Tailwind/design tokens; some nuance may differ depending on the design system.

---

## Deliverables for Next Phase

### Files / Components to Receive High-Fidelity Visual Rewrite

| File / component | Scope of change |
|------------------|-----------------|
| **UnifiedInboxPage.tsx** | Page-level spacing, column proportions, optional header restyle (title, Archive, Mark unread) to align with target. Preserve layout structure and all state/handlers. |
| **InboxConversationList.tsx** | Rebuild conversation row markup (avatar pill, name, metadata, preview, badges, timestamp); minimize checkboxes; restyle filter pills and channel selector; apply new tokens. Preserve selection, filters, and scroll. |
| **ConversationHeader.tsx** | Rebuild header layout and typography to match target (name, order badge, secondary line, link controls). Preserve all props and `onActionClick`. |
| **ConversationThread.tsx** | Restyle message bubbles, spacing, and alignment; restyle AI suggestion chip; rebuild composer UI (reply channel pills, textarea, Send). Preserve scroll ref, send logic, channel state, and AI suggestion behavior. |
| **PersonOrdersPanel.tsx** | Restyle panel container, title, section labels, and order list rows. Preserve data flow, selection, and `onOpenOrderDetails`. |
| **OrderContextSummary.tsx** | Rebuild summary block and typography to match target; use only existing Order fields. |

### What Should Be Rebuilt vs Lightly Restyled

- **Rebuild:** Conversation list rows (markup and layout to include avatar pill, hierarchy, badges, timestamp). Center header layout and typography. Composer reply channel UI (segmented pills). Right panel section structure and summary block. Filter pills in the left sidebar.
- **Lightly restyled:** Message bubble internals (same structure, new colors/spacing); order list row internals (same buttons, new look); existing Archive/Mark unread buttons if they stay in place.

### Where Functionality Must Be Preserved While Markup Changes

- **InboxConversationList:** Row click still calls `onSelectConversation(conversation.id)`. Checkbox still toggles selection and is used for archive/mark read; state and handlers unchanged. Filter and channel state still drive `useConversationsList(filters)`.
- **ConversationView / ConversationHeader:** Link modal open, order badge source (first order for person), display name and secondary line source unchanged.
- **ConversationThread:** Message list and scroll ref; `activeConversationId`, `activeChannel`, `sendReplyMutation`, `setReplyText`; AI suggestion fetch and insert; channel switch and send per channel—all preserved when replacing Select with pills or restyling.
- **PersonOrdersPanel:** `useOrdersByPersonId`, `selectedOrderId`, `onSelectOrder`, `onOpenOrderDetails`, display order for summary, empty/loading/error—all preserved when adding section labels and new styles.

### Unavoidable Deviations Summary

- Order ID in list rows only if derivable without N+1; otherwise center header and right panel only.
- Cemetery filter, Compose, “N new”, Quick replies, Attach: only if already in app or in scope.
- Actions section in right panel: structure only; do not implement until functionality exists.
