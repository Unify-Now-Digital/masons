# Data Model: Inquiries Pipeline Board

## Overview

The feature exposes a read-model built from existing entities (`enquiries`, `people`, `quotes`, `orders`) plus computed fields required for Kanban and detail panel rendering.

## Entities

## 1) Enquiry (source)

- **Identity**: `enquiries.id`
- **Organization scope**: `enquiries.organization_id`
- **Person link**: `enquiries.person_id -> people.id`
- **Order link**: `enquiries.order_id -> orders.id` (nullable)
- **Relevant fields**:
  - Timeline: `created_at` (authoritative sort/filter field), `updated_at` (ignored for sorting)
  - Classification: `channel`, `sub_type`
  - Communication/context: `message`, `source_page`, `location`, `contact_pref`, `appointment_at`, `appointment_kind`
  - Configuration/media: `details` (jsonb), `photo_urls` (array)

## 2) Person (source)

- **Identity**: `people.id`
- **Referenced by**: enquiries, quotes (`customer_id`), orders (`person_id`)
- **Display fields (to verify names)**: name components, email, phone

## 3) Quote (source / linked heuristic)

- **Identity**: `quotes.id`
- **Person link**: `quotes.customer_id -> people.id` (legacy name, canonical person link)
- **Relevant fields**: `created_at`, `status`, totals used for detail panel
- **Linking heuristic**:
  - Candidate quote if `quotes.customer_id = enquiries.person_id`
  - Candidate quote if `quotes.created_at >= enquiries.created_at`
  - Choose latest candidate by `quotes.created_at DESC`

## 4) Order (source)

- **Identity**: `orders.id`
- **Person link**: `orders.person_id -> people.id`
- **Quote link**: `orders.quote_id` (optional for enrichment)
- **Relevant fields**: `status`

## 5) InquiryPipelineItem (derived row returned by RPC)

- **Identity**: `enquiry_id`
- **Stage**: one of `new | quoted | order_created`
- **Stage precedence**: `order_created` > `quoted` > `new`
- **Core payload groups**:
  - Board metadata: channel, stage, created_at
  - Person summary: name, email, phone, person link target
  - Channel card display fields (channel-specific values)
  - Detail panel sections:
    - Header: channel, sub_type, stage, created_at
    - Inquiry: message/source/location/contact/appointment fields
    - Configuration: memorial, stone, size, font, inscription, add-ons, price when present in `details`
    - Photos: thumbnails when `photo_urls` non-empty
    - Linked quote/order summaries when present

## Derived Rules

1. **order_created** when `enquiries.order_id IS NOT NULL` (overrides all else).
2. **quoted** when a linked quote exists per the heuristic AND `quotes.status = 'accepted'`.
3. **new** when no linked order and no qualifying linked quote.

## Filter Model

- **Channels**: multi-select from `contact | quote | appointment | call | shortlist` (default: all)
- **Date range**:
  - presets: today, last_7_days, last_30_days, all_time
  - custom: from/to date
  - default: last_30_days

## Validation and Consistency Rules

- Every returned enquiry must produce exactly one stage.
- Only organization-member callers are authorized.
- Sorting is by enquiry `created_at` only.
- RPC remains read-only and does not mutate source tables.
