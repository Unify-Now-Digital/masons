# Contract: `get_inquiries_pipeline`

## Purpose

Return all Kanban and detail-panel data for organization enquiries in a single call, with SQL-computed stage and server-side authorization.

## Interface

- **Type**: Supabase/Postgres RPC (SECURITY DEFINER)
- **Name**: `get_inquiries_pipeline`
- **Arguments**:
  - `p_organization_id` (uuid, required)
  - `p_channels` (text[] or null for all channels)
  - `p_from_date` (date or timestamptz, nullable depending on range mode)
  - `p_to_date` (date or timestamptz, nullable depending on range mode)

## Authorization Contract

1. Caller must be authenticated.
2. RPC must verify membership using `user_is_member_of_org(p_organization_id)`.
3. If membership check fails, RPC returns authorization error and no data.

## Stage Semantics Contract

- Stage enum values returned: `new`, `quoted`, `order_created`
- Precedence: `order_created` > `quoted` > `new`
- First matching rule wins.
- Any row with non-null `enquiries.order_id` must return `order_created`.
- The `quoted` stage requires the linked quote to have `status = 'accepted'`.

## Quote-Linking Contract

- Linked quote candidate when:
  - `quotes.customer_id = enquiries.person_id`
  - `quotes.created_at >= enquiries.created_at`
- When multiple candidates exist, use latest by `quotes.created_at`.
- Quoted determination is based on linked quote `status = 'accepted'`. The status value `converted` is informational only — such enquiries reach `order_created` via `enquiries.order_id`.

## Response Shape (logical)

Each row is **flat** — one row per enquiry, with nullable columns for optional joined data. Nested JSON or pre-computed display strings are NOT permitted; the frontend renders all display logic from raw source values.

**Required columns per row:**

- **Identity**: `enquiry_id`
- **Computed**: `stage` (one of `new | quoted| order_created`)
- **Enquiry fields (raw)**: `channel`, `sub_type`, `created_at`, `source_page`, `message`, `location`, `contact_pref`, `appointment_at`, `appointment_kind`, `details` (jsonb), `photo_urls` (text[])
- **Person fields (joined, nullable if person row missing)**: `person_id`, `person_first_name`, `person_last_name`, `person_email`, `person_phone`
- **Linked quote fields (nullable when no linked quote)**: `linked_quote_id`, `linked_quote_status`, `linked_quote_total`, `linked_quote_created_at`
- **Linked order fields (nullable when `enquiries.order_id IS NULL`)**: `linked_order_id`, `linked_order_status`

**Disallowed in this RPC:**

- Pre-formatted card strings (e.g. no `card_primary_text`)
- Nested JSON structures for joined records (e.g. no `linked_quote: jsonb`)
- Stage label text (the frontend maps stage keys to user-facing labels)

The flat shape matches existing RPC patterns in the codebase (`get_customer_messages`, `get_unlinked_messages`).

## Filtering Contract

- Channels filter applies only to known channels (`contact`, `quote`, `appointment`, `call`, `shortlist`).
- Date window applies to `enquiries.created_at`.
- Null date bounds may be used to represent all-time.

## Ordering Contract

- Rows are ordered by `enquiries.created_at` descending unless an explicit, documented override is introduced later.

## Error Contract

- **Unauthorized**: caller is not a member of organization.
- **Invalid input**: malformed channels or date range (`from > to`).
- **Unexpected failure**: internal SQL/runtime error.

All errors must be deterministic and safe (no secret leakage).
