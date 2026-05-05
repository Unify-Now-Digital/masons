# Research: Inquiries Pipeline Board

## Decision 1: Compute stage in SQL inside one RPC

- **Decision**: Implement stage logic in `get_inquiries_pipeline(...)` with deterministic precedence `order_created` > `quoted` > `new` and first-match-wins semantics.
- **Rationale**: Centralizing stage logic in SQL guarantees consistent behavior across all clients, satisfies spec requirements, and avoids frontend drift.
- **Alternatives considered**:
  - Compute in frontend after fetching raw rows: rejected because it duplicates business rules in UI and risks mismatched stages.
  - Persist stage to table: rejected because spec requires computed stages and read-mostly v1.

## Decision 2: Linked quote heuristic without quote-enquiry FK

- **Decision**: Define linked quote as `quotes.customer_id = enquiries.person_id` and `quotes.created_at >= enquiries.created_at`; when multiple match, take latest by `quotes.created_at`.
- **Rationale**: This matches audited schema realities and produces deterministic linkage despite missing `quotes.enquiry_id`.
- **Alternatives considered**:
  - Link by nearest quote regardless of timestamp direction: rejected due to false positives from pre-enquiry quotes.
  - Link via customers table: rejected because table is stale and not canonical.

## Decision 3: Paid stage dropped from v1 scope after status discovery

- **Decision**: Drop the Paid stage from v1. Discovery query confirmed `quotes.status` contains only `accepted` and `converted` — no payment signal exists. The board ships with three lanes: New, Quoted, Order Created. `quoted` is keyed on `quotes.status = 'accepted'`.
- **Rationale**: An always-empty Kanban column is a UX wart. A Paid stage can be added later without breaking changes once a payment signal is introduced (see planned Feature 2 — Quote → Order via Payment Confirmation).
- **Alternatives considered**:
  - Keep an empty Paid lane: rejected because the column would be permanently empty in production until Feature 2 ships.
  - Map `accepted` to Paid instead of Quoted: rejected because `accepted` semantically means the quote was accepted, not paid.

## Decision 4: Single RPC response shape serves board and detail panel

- **Decision**: Return complete board card payload + detail panel payload in one result set to support one request per filter change and zero waterfall lookups.
- **Rationale**: Matches performance requirement and recent codebase pattern favoring single RPC over chained queries.
- **Alternatives considered**:
  - Board list call + per-card detail calls: rejected due to waterfall behavior and inconsistent loading states.
  - Separate quote/order enrichment calls: rejected for same reason.

## Decision 5: Authorization model for SECURITY DEFINER RPC

- **Decision**: Keep existing RLS policies and add explicit membership check in RPC body (`user_is_member_of_org(...)`) before returning rows.
- **Rationale**: SECURITY DEFINER can bypass caller RLS context; explicit membership check is mandatory defense.
- **Alternatives considered**:
  - Rely on RLS only: rejected as insufficient under SECURITY DEFINER.
  - Restrict RPC to admin users: rejected because feature is for all authenticated org members.

## Decision 6: Frontend architecture alignment

- **Decision**: Build feature under `src/modules/inquiries/` with query key factory `inquiriesKeys`, organization scope from `useOrganization()`, lazy-loaded route, and sidebar item insertion between Inbox and Orders.
- **Rationale**: Aligns with constitution module boundaries and existing app conventions.
- **Alternatives considered**:
  - Place page under legacy `src/pages/`: rejected for new feature module development.
  - Use ad hoc query keys: rejected because it diverges from existing key factory pattern.

## Required Pre-Migration Verification Queries

- **Query A**: Distinct quote statuses to finalize the Quoted-stage mapping. (Completed: only `accepted` and `converted` exist; Paid stage dropped.)
- **Query B**: Distinct order statuses for display/semantics verification.
- **Query C**: People column names used by detail panel fields.

Implementation must execute and document outcomes of these checks before finalizing migration SQL constants.
