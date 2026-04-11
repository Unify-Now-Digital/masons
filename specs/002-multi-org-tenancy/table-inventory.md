# Table inventory: `organization_id` scope

**Feature**: [002-multi-org-tenancy](./spec.md)  
**Sources**: `supabase/migrations/*.sql`, [data-model.md](./data-model.md), app module usage (`src/modules/**`).

## New tables (tenant registry)

| Table | `organization_id` |
|-------|-------------------|
| `organizations` | N/A (root tenant) |
| `organization_members` | FK to `organizations` (membership row, not “business data”) |

## Core business — batch one (orders spine)

| Table | Notes |
|-------|--------|
| `orders` | Root entity for many satellites |
| `invoices` | FK `order_id` → orders |
| `jobs` | FK `order_id` → orders |
| `workers` | Workshop resources |
| `worker_availability` | FK worker |
| `job_workers` | Join jobs ↔ workers |

## People / CRM / catalogue — batch two

| Table | Notes |
|-------|--------|
| `customers` | Primary “people” store (app uses `customers`, not `people`) |
| `companies` | Referenced by app; add column when table exists in DB |
| `products` | Memorials catalogue |
| `quotes` | Pre-order quotes |
| `inscriptions` | Inscription records |
| `order_people` | orders ↔ customers |
| `order_additional_options` | Order options |

## Inbox / comms — batch three

| Table | Notes |
|-------|--------|
| `inbox_conversations` | Unified threads |
| `inbox_messages` | Messages |
| `gmail_connections` | Inbox Gmail OAuth |
| `gmail_accounts` | Legacy/sync Gmail |
| `gmail_emails` | Synced mail rows |
| `whatsapp_connections` | WhatsApp |
| `whatsapp_managed_connections` | Managed WhatsApp |
| `whatsapp_connection_events` | Events |
| `whatsapp_user_preferences` | Prefs |
| `inbox_ai_thread_summaries` | AI summaries |
| `inbox_ai_suggestions` | AI suggestions |

## Permits / proofs / payments — batch four (remaining)

| Table | Notes |
|-------|--------|
| `permit_forms` | Forms |
| `order_permits` | Order ↔ permit |
| `permit_activity_log` | Permit audit |
| `cemeteries` | Permit tracker |
| `order_comments` | Order discussion |
| `order_proofs` | Proof workflow |
| `invoice_payments` | Invoice payments |
| `payments` | Reconciliation payments |
| `order_payments` | Order payment lines |
| `order_extras` | Extras / invoice linkage |
| `revolut_connections` | Revolut OAuth |
| `processed_webhook_events` | Idempotency (tenant-scoped via org or user; see below) |
| `activity_logs` | Activity stream |
| `table_view_presets` | UI presets (user + org) |
| `messages` | Legacy unified inbox messages; scope if still used |

## Exempt or special-case

| Object | Rationale |
|--------|-----------|
| `processed_webhook_events` | Often global idempotency; if keyed only by external id, may remain service-role-only with RLS denying authenticated — **if** we add `organization_id`, scope by tenant. Otherwise document **exempt** and keep service-only. |

## Migration dependency note

Add `organization_id` to **parent** tables before or with children when FKs reference org-scoped parents. `orders` should receive `organization_id` early; satellites follow.
