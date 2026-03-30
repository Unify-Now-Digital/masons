# Data Model: order_people

## New Table

```sql
create table public.order_people (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  person_id uuid not null references public.customers(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(order_id, person_id)
);

create unique index idx_order_people_one_primary_per_order
  on public.order_people (order_id) where is_primary = true;

create index idx_order_people_order_id on public.order_people(order_id);
create index idx_order_people_person_id on public.order_people(person_id);
```

## Backward Compatibility
- Keep `orders.person_id`, `orders.person_name`
- On save: mirror primary into orders.person_id and orders.person_name
- Read: load from order_people; fallback to orders.person_id if no rows
