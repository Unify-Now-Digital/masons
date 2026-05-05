# Quickstart: Inquiries Pipeline Board

## 1) Run pre-migration verification queries

Before writing final migration SQL, run and document:

1. Distinct `quotes.status` values — confirmed during planning: only `accepted` and `converted` exist. `accepted` drives the `quoted` stage.
2. Distinct `orders.status` values (for display semantics)
3. `people` column names for name/email/phone mapping


## 2) Implement SQL migration and RPC

1. Create migration file under `supabase/migrations/`.
2. Implement SECURITY DEFINER RPC: `get_inquiries_pipeline(p_organization_id, p_channels, p_from_date, p_to_date)`.
3. Add explicit membership check via `user_is_member_of_org(...)`.
4. Implement stage precedence:
   - `order_created` if `enquiries.order_id IS NOT NULL`
   - `quoted` if linked quote exists with `status = 'accepted'`
   - `new` otherwise
5. Implement quote-link heuristic:
   - `quotes.customer_id = enquiries.person_id`
   - `quotes.created_at >= enquiries.created_at`
   - latest quote wins
6. Return all fields needed for:
   - lane grouping
   - channel-specific card display
   - detail panel sections

## 3) Implement frontend module

1. Add `src/modules/inquiries/` with `api/`, `hooks/`, `components/`, `pages/`, `types/`, `index.ts`.
2. Add `inquiriesKeys` key factory mirroring inbox patterns.
3. Use `useOrganization()` for org context and member-level access (no super-admin gate).
4. Build board with three lanes grouped by returned stage: New, Quoted, Order Created.
5. Build filters:
   - channels multi-select (default all)
   - date range presets + custom (default last 30 days)
6. Ensure one RPC call per filter change.
7. Build detail panel with required sections and optional blocks.
8. Add loading skeletons, empty states, and retryable error states.

## 4) Wire navigation and route

1. Add lazy route integration in app router.
2. Insert sidebar item "Inquiries" between Inbox and Orders.
3. Preserve dual-router architecture (`src/app` + `src/pages`).

## 5) Verify behavior

1. Stage precedence test cases:
   - row with order_id always lands in `order_created`
   - no match lands in new
2. Channel rendering checks per channel requirements.
3. Filter checks:
   - defaults apply on first load
   - one request per filter change
4. Detail panel checks:
   - required sections always present where applicable
   - optional sections render only when data exists
5. Run lint and smoke test navigation.

## 6) Out-of-scope guardrails

Do not implement in this feature:
- drag-and-drop
- manual stage changes
- send-quote action
- search
- bulk actions
- editing flows

---

## Implementation verification (2026-05-06)

Implemented in-repo:

- Migration `supabase/migrations/20260506124500_get_inquiries_pipeline.sql` defining `get_inquiries_pipeline`.
- Frontend module `src/modules/inquiries/` with Kanban (three lanes), filters, detail sheet, and single RPC call per filter change.
- Route `/dashboard/inquiries` (lazy) and sidebar item **Inquiries** after **Inbox**.
- Orders deep-link `?quote=<uuid>` opens the matching order when `orders.quote_id` matches.

Scoped ESLint on `src/modules/inquiries/**` and `src/app/router.tsx` passes. Full-repo `npm run lint` still reports pre-existing errors outside this feature.
