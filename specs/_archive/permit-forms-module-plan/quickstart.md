## Quickstart / Execution Notes

1) Migrations
- Create permit_forms table, name index, updated_at trigger, RLS policies.
- Add orders.permit_form_id with FK on delete set null + index.

2) API & hooks
- Add permitForms.api.ts with list/search, create, update, delete.
- Add React Query hooks: usePermitForms(search), useCreate/Update/Delete.
- Extend Orders types/API payloads to include permit_form_id; keep nullable.

3) UI
- Permit Forms page under Inscriptions: search, table (Name, Link with Open, Note, Created, Actions), CRUD drawers, delete confirm.
- Drawers: Name* (required), Link (optional), Note (optional textarea); use AppDrawerLayout.
- Orders drawer: add Permit form select (clearable, uses usePermitForms list), show Open when link exists, persist permit_form_id.

4) QA
- Apply migrations cleanly; RLS works for auth users.
- CRUD on Permit Forms works; delete nulls existing order references.
- Orders drawer select/clear persists; Open works.
- npm run build passes.
