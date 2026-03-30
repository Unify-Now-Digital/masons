## Schema Changes

### Table: permit_forms (new)
- id uuid primary key default gen_random_uuid()
- name text not null
- link text null
- note text null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Indexes:
- btree on name

Triggers:
- updated_at on update (reuse existing helper if available; otherwise add simple trigger + function)

RLS:
- Match People/Companies: authenticated users can select/insert/update/delete.

### Orders
- Add column permit_form_id uuid null references permit_forms(id) on delete set null.
- Index on permit_form_id.

Relationship:
- Each order may reference 0/1 permit form; deleting a permit form nulls the FK.
