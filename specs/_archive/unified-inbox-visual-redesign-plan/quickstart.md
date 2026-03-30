# Quickstart: Unified Inbox Visual Redesign

## Run locally

1. From repo root: `npm run dev`
2. Open the app and go to Unified Inbox (e.g. Dashboard → Inbox).
3. Verify four columns: People | Conversations | Conversation | Orders.

## What to check after redesign

- **Panels:** Rounded, bordered, consistent padding; page background `bg-muted/30`.
- **Tabs:** Pill style (rounded-full).
- **Conversation header:** Avatar + name + subline + actions.
- **Conversation list:** Active row has `bg-muted/60` and left border accent.
- **Orders panel:** Dark header (`bg-slate-900 text-white`) with count badge.
- **Composer:** Sticky dock at bottom; suggestion chip in composer header row.
- **Scroll / behavior:** Message list scrolls; auto-read and realtime unchanged; no layout jumps.

## No backend or env changes

This is markup and Tailwind only. No new env vars or Supabase changes.
