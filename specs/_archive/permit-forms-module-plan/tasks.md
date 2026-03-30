## Phases & Tasks

- [ ] Phase 1: Migrations
  - [X] Create permit_forms table (columns, name index, updated_at trigger, RLS policies).
  - [X] Add orders.permit_form_id with FK (on delete set null) and index.

- [ ] Phase 2: API & Types
  - [X] Add permitForms.api.ts (list with search, create, update, delete).
  - [X] Add React Query hooks: usePermitForms(search), useCreatePermitForm, useUpdatePermitForm, useDeletePermitForm.
  - [X] Extend Orders types/API payloads to include permit_form_id (nullable).

- [ ] Phase 3: UI – Permit Forms module
  - [X] Add nav entry under Inscriptions and route to Permit Forms page.
  - [X] Build Permit Forms page: search bar, table (Name | Link/Open | Note | Created | Actions), pagination/empty states per People pattern.
  - [X] Add create/edit drawers using AppDrawerLayout (fields: Name*, Link, Note; validation name required).
  - [X] Add delete with confirm dialog.

- [ ] Phase 4: UI – Orders integration
  - [X] Add “Permit form” select to Order create/edit drawers (clearable, shows name, Open button when link exists).
  - [X] Persist permit_form_id on create/update; handle null/clear.
  - [X] (Optional) Show permit form name/link in order detail if pattern exists.

- [ ] Phase 5: QA
  - [X] Verify CRUD + delete nulls order references; search works.
  - [X] Verify Orders drawer select/clear + Open link.
  - [X] npm run build (and tests if present).
