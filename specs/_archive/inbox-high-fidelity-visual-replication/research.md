# High-Fidelity Inbox Replication — Research

## Visual vs light restyle

**True visual rewrite (rebuild markup/layout):**
- **Left:** Conversation row structure (avatar pill + name + metadata + preview + badges + timestamp). Filter bar (pill-shaped, selected = dark green). Channel control (pill group or compact dropdown). Checkbox placement/size.
- **Center:** Header (name size, order badge style, metadata line, link controls). Composer (reply channel as segmented pills; textarea + Send styling). AI suggestion chip (new look, same behavior).
- **Right:** Panel title (“ORDER CONTEXT”), summary block layout, section labels (WORKFLOW GATES, FINANCIAL), order list row styling.

**Light restyle (keep structure, change classes/colors/spacing):**
- Message bubble internals (same div structure, new colors/borders/spacing).
- Order list row internals (same button, new look).
- Archive / Mark unread buttons (optional restyle).

## Avatar/initial pills and checkboxes

- **Initials source:** Person name from `personNameMap.get(conversation.person_id)` or `conversation.primary_handle`; split and take first two letters (or first char + second word first char). Unlinked/unknown: use “?” or first two chars of primary_handle.
- **Pill:** Small square or rounded rectangle (e.g. `w-8 h-8 rounded-md flex items-center justify-center text-xs font-medium bg-primary text-primary-foreground`). Optional status dot (e.g. red for urgent) as overlay.
- **Checkboxes:** Keep in DOM for multi-select; make them small and low-contrast (e.g. `opacity-60`, smaller size, or show only on row hover) so the row reads like the target. Same `onToggleSelection`, `selectedItems`, and archive/mark-read behavior.

## Filter pills and channel control

- **Filter pills:** Replace the current `<Button>` group with a row of pill-shaped elements. Selected: `bg-emerald-700 text-white` (or similar dark green). Unselected: `bg-muted/50 text-muted-foreground` or `bg-slate-100 text-slate-700`. Same `listFilter`, `onListFilterChange`. Labels: All, Unread, Urgent, Unlinked (no Cemetery unless in scope).
- **Channel:** Either (1) compact pill group “All | Email | SMS | WhatsApp” with same selected/unselected styling, or (2) a minimal dropdown restyled to match (smaller trigger, no heavy border). Preserve `channelFilter`, `onChannelFilterChange`.

## Center header and thread

- **Header:** Name as larger font (e.g. `text-lg font-semibold`). Order badge: subtle (e.g. `bg-emerald-100 text-emerald-800` or similar). Secondary line: smaller, muted. Link/change-link: smaller button or text link. Keep same props and `onActionClick`.
- **Thread:** Bubbles: incoming = white/light grey background, subtle border; outgoing = light green background (e.g. `bg-emerald-50` or `bg-green-50`). More rectangular (e.g. `rounded-lg` not `rounded-full`). Sender + channel icon + timestamp on one line, smaller text. Preserve scroll ref and message list structure.

## Composer and reply channel

- **Reply channel:** Replace `<Select>` with a row of buttons/pills: “Reply via” label + [Email] [WhatsApp] [SMS]. Selected pill: dark green bg; unselected: light grey. Same state: `selectedChannel`, `setSelectedChannel`; when only one channel available, show single pill or hide. Preserve `effectiveChannel`, `channelLocked`, and send logic.
- **Composer:** Textarea with lighter border, more padding; Send button with dark green background. Optional “Attach” and “Quick” pills only if they already exist; style to match.

## Right panel

- **Title:** Uppercase or title case “Order context” with smaller, tracked typography; optional “×” that does nothing or hides panel if we have that behavior.
- **Summary:** Order ID prominent; customer, location, type below; status badges in a row. Use `rounded-md border border-border bg-muted/30` or similar; avoid heavy card shadow.
- **Sections:** Add labels “Workflow” (or “WORKFLOW GATES”) and “Financial” (or “FINANCIAL”) above the existing status badges and value; map only existing Order fields (permit_status, stone_status, proof_status, value, deposit_date, etc.). No Actions section content; leave space for future.

## Tokens to replace

- Do not rely on default `primary`/`secondary`/`muted` if they make the page look like the old app. Use explicit colors for this route: e.g. `emerald-700` for primary actions and selected states, `emerald-100`/`emerald-50` for subtle fills, `red-600` for URGENT, `violet-500` for UNLINKED, `amber-600` or olive for ACTION REQUIRED. Softer neutrals: `slate-100`, `slate-200` for borders and backgrounds.

## Small presentational subcomponents

- **InboxAvatarPill:** `{ initials: string; statusDot?: 'urgent' | 'unlinked' | null }` — renders the pill + optional dot. Reusable in list rows and optionally in header.
- **InboxFilterPill:** `{ label: string; selected: boolean; onClick: () => void }` — single pill for filter bar.
- **InboxStatusBadge:** `{ variant: 'urgent' | 'unlinked' | 'action' | 'channel'; children: ReactNode }` — applies mockup colors (red, purple, olive, neutral).
- **ReplyChannelPills:** `{ channels: ('email'|'sms'|'whatsapp')[]; value: string; onChange: (v) => void; disabled?: boolean }` — segmented control for composer.

These keep the main components cleaner and ensure consistent styling.
