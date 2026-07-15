-- Deleting a person previously SET NULL on invoices.person_id, silently unlinking
-- their invoices (including paid ones) and reverting attribution to fragile
-- customer_name string matching. RESTRICT instead: a person with invoices cannot
-- be deleted until those invoices are unlinked or removed.
-- Applied via Dashboard SQL editor 2026-07-16; statements run individually.

alter table invoices drop constraint invoices_person_id_fkey;

alter table invoices
  add constraint invoices_person_id_fkey
  foreign key (person_id) references people(id) on delete restrict;
