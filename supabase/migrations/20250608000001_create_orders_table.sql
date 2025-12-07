-- Create orders table for Phase 1
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  order_type text not null,
  sku text,
  material text,
  color text,
  stone_status text default 'NA' check (stone_status in ('NA', 'Ordered', 'In Stock')),
  permit_status text default 'pending' check (permit_status in ('form_sent', 'customer_completed', 'pending', 'approved')),
  proof_status text default 'Not_Received' check (proof_status in ('NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered')),
  deposit_date date,
  second_payment_date date,
  due_date date,
  installation_date date,
  location text,
  value decimal(10,2),
  progress integer default 0 check (progress >= 0 and progress <= 100),
  assigned_to text,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  timeline_weeks integer default 12,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.orders enable row level security;

-- Create policies (allow all for now - will be restricted with auth later)
create policy "Allow all access to orders" on public.orders
  for all using (true) with check (true);

-- Create updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_orders_updated_at
  before update on public.orders
  for each row execute function public.update_updated_at_column();

