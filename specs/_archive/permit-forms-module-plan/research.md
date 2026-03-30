## Research / Inventory

- Patterns to mirror: People module (page, table, CRUD drawer, API/hooks), Companies module for RLS patterns, Orders drawer for select fields and save flow, nav/routing structure for Inscriptions section.
- Components: AppDrawerLayout (compact drawers), shared table/search patterns (People), confirm dialogs (People delete), select inputs with clear/open patterns (Orders, memorial selections).
- Data: Orders currently lack permit_form_id; will add nullable FK with on delete set null.
- Supabase helpers: check existing updated_at trigger helper and RLS policy helpers used by People/Companies; reuse if present.
- Routing/nav: locate Inscriptions submenu; add Permit Forms entry and route (likely `/permit-forms` or nested under inscriptions).

Open items to decide during implementation:
- Exact route path: follow existing Inscriptions routing convention.
- Search: match People implementation (client or server).
