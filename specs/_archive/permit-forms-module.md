# Permit Forms module (list + drawer) + Order integration

## Overview

Add an internal “Permit Forms” module with a searchable table and create/edit drawers, and allow Orders to reference a permit form. This mirrors the People module patterns and is staff-only.

**Context:**
- Internal back-office tool (no customer-facing UI).
- Placed under Inscriptions in left nav; behaves like People (table + drawer + delete).
- Orders need a reference to a permit form (0/1) for quick linking/opening.

**Goal:**
- Create `permit_forms` table with basic CRUD and RLS matching internal patterns.
- Provide a Permit Forms page (list + search + create/edit/delete) using compact drawers.
- Integrate Orders drawer with a “Permit form” selectable field and open-link helper.

---

## Current State Analysis

### Entity 1 Schema

**Table:** `orders`

**Current Structure (relevant):**
- Existing order fields; no permit form reference today.
- Orders drawer supports various linked entities (customers, memorials, etc.).

**Observations:**
- Lacks a permit-form reference column.
- UI patterns for selects and drawers already established in Orders.

### Entity 2 Schema

**Table:** `permit_forms` (new)

**Current Structure:**
- Does not exist yet; will be created with minimal metadata (name, link, note, timestamps).

**Observations:**
- Needs RLS consistent with internal modules (People/Companies).
- Needs updated_at trigger for auditability.

### Relationship Analysis

**Current Relationship:**
- No relationship between orders and permit forms.

**Gaps/Issues:**
- Orders cannot store/select a permit form reference.
- No library to manage reusable permit form links/notes.

### Data Access Patterns

**How Orders Are Currently Accessed:**
- Orders drawer uses selects/lookups for related entities.
- Queries often fetch lightweight lists for drawer selects.

**How Permit Forms Will Be Accessed:**
- List + search (by name) for table and drawer selects.
- CRUD via React Query hooks similar to People module.

**How They Are Queried Together:**
- Orders will store `permit_form_id`; optional join/fetch by id for display/open link.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- Create table `permit_forms`:
  - id uuid primary key default gen_random_uuid()
  - name text not null
  - link text null
  - note text null
  - created_at timestamptz not null default now()
  - updated_at timestamptz not null default now()
- Index: btree on `name` for search.
- Trigger: update `updated_at` on update (reuse existing trigger helper if present; otherwise add simple trigger/function).
- RLS: allow authenticated select/insert/update/delete (match People/Companies style).
- Orders: add column `permit_form_id uuid null references permit_forms(id) on delete set null`.

**Non-Destructive Constraints:**
- All additive; no drops or renames.
- Nullable FK to avoid breaking existing orders; on delete set null.
- No uniqueness on name.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- `listPermitForms(search?: string)` filtering by name.
- Orders: include `permit_form_id`; fetch permit form by id for display/open link or join where appropriate.

**Recommended Display Patterns:**
- Permit Forms table columns: Name, Link (Open if present), Note, Created, Actions.
- Orders drawer: “Permit form” searchable select showing name; secondary text with link domain or “No link”; clearable; “Open” button when link exists.

---

## Implementation Approach

### Phase 1: Data & API
- Add migrations for `permit_forms`, trigger, RLS, and `orders.permit_form_id`.
- Add API + React Query hooks: list/create/update/delete permit forms; extend Orders types/API with `permit_form_id`.

### Phase 2: UI – Permit Forms module
- Add nav item under Inscriptions.
- Build Permit Forms page: search bar, table (Name, Link/Open, Note, Created, Actions), pagination per People pattern.
- Create/edit drawers (compact AppDrawerLayout): fields Name*, Link, Note; validation (Name required).
- Delete flow with confirm; relies on FK on delete set null.

### Phase 3: UI – Orders integration
- Add “Permit form” select to Order create/edit drawers (searchable, clearable).
- Show “Open” button when selected permit form has a link (new tab, noreferrer).
- Display permit form name/link in order detail where applicable.

### Safety Considerations
- Additive schema; nullable FK; on delete set null to avoid breakage.
- RLS aligned with existing internal modules to prevent unauthorized access.
- Test: migrations apply cleanly; CRUD for permit forms; Order select/save for permit_form_id; link open behavior.
- Rollback: drop new table/column if unreleased; keep data backups for production if needed.

---

## What NOT to Do

- No customer-facing UI; internal only.
- No file uploads or complex validation of link (plain text allowed).
- No invoice/job architectural changes; no advanced approval workflows.
- No changes to existing form layouts beyond adding the new field.

---

## Open Questions / Considerations

- Routing path: use `/permit-forms` vs `/inscriptions/permit-forms`—follow existing Inscriptions routing conventions.
- Search implementation: client vs server—match People module approach.
- If a shared trigger helper exists, reuse; otherwise add minimal trigger for updated_at.
