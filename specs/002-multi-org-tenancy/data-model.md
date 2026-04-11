# Data Model: Multi-Organization Tenancy

**Spec**: [spec.md](./spec.md)  
**Date**: 2026-04-11

## New entities

### `organizations`

| Field | Type | Notes |
|-------|------|--------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `name` | text | Display name; default org **Churchill** for migration |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Optional later: slug, billing metadata (out of scope unless product already has patterns).

### `organization_members`

| Field | Type | Notes |
|-------|------|--------|
| `id` | uuid (PK) | |
| `organization_id` | uuid (FK → organizations) | ON DELETE CASCADE or RESTRICT (prefer CASCADE for dev; confirm for production) |
| `user_id` | uuid (FK → auth.users) | |
| `role` | text | Check constraint: `admin` \| `member` |
| `created_at` | timestamptz | |
| **Unique** | `(organization_id, user_id)` | One membership row per user per org |

Indexes: `(user_id)`, `(organization_id)`.

## Tenant scope on existing entities

Each **organization-scoped** table gains:

- `organization_id uuid NOT NULL` (after backfill) references `organizations(id)`.

**Spec-named domains**: orders, invoices, jobs, people (customers), companies, products, inbox_conversations, inbox_messages, gmail_connections, permits (and related permit tables), workers (and job_workers, worker_availability as applicable).

**Additional tables** (from codebase audit—must be included or explicitly exempted):

- Orders satellites: `order_people`, `order_additional_options`, `order_permits`, `order_proofs`, `order_payments`, `order_extras`, …
- Invoicing: `invoice_payments`, invoices-linked views
- Jobs: `jobs`, `job_workers`
- Inbox AI: `inbox_ai_thread_summaries`, `inbox_ai_suggestions`
- Comms: `whatsapp_connections`, `whatsapp_managed_connections`, `whatsapp_connection_events`, `whatsapp_user_preferences` (scope per product rules—likely org-scoped if inbox is)
- Activity: `activity_logs` (if tenant-scoped)
- Workers: `workers`, `worker_availability`
- Memorials/products/inscriptions linkage as tied to orders/org
- Payments: `payments`, `revolut_connections`, `processed_webhook_events` (as applicable)
- Permit agent: `cemeteries`, `order_comments`, `permit_forms`, `permit_activity_log`
- UX: `table_view_presets` (likely per user+org)

**Legacy `messages` table** (early unified inbox): decide deprecate vs org-scope; if still used, add `organization_id`.

## Relationships

- One **organization** has many **members** (via `organization_members`).
- One **user** may have many **memberships** (many-to-many with orgs).
- All **scoped business records** reference exactly one **organization**.

## RLS (conceptual)

- **Read/Write**: User may access row if `organization_id` is in `(select organization_id from organization_members where user_id = (select auth.uid()))`.
- **Admin-only** operations (e.g. manage members, delete org-level resources if allowed): require `role = 'admin'` in `organization_members` for that `organization_id`.
- Policies use `(select auth.uid())` per constitution.

Exact policy text and `SECURITY DEFINER` helpers (if any) belong in implementation migrations.

## Migration ordering (high level)

1. Create `organizations`, `organization_members` (RLS enabled).
2. Insert default org Churchill.
3. Add nullable `organization_id` to scoped tables; backfill Churchill; set NOT NULL + FKs.
4. Insert `organization_members` for existing users (strategy: all users → Churchill member/admin—implementation detail).
5. Replace/enhance existing policies from `user_id`-only to org-aware patterns.
