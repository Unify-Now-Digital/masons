-- Adds person_id to invoices so an invoice links to a person by id rather than
-- reconstructing the link from a free-text customer_name string match.
-- FK is ON DELETE SET NULL to match orders.person_id / inbox_conversations.person_id,
-- so deleting a person nulls the reference instead of blocking the delete.
-- (Applied to prod via Dashboard SQL editor on 2026-07-15; recorded here for parity.)

alter table public.invoices
  add column if not exists person_id uuid;

alter table public.invoices
  drop constraint if exists invoices_person_id_fkey;

alter table public.invoices
  add constraint invoices_person_id_fkey
  foreign key (person_id) references public.people(id)
  on delete set null;