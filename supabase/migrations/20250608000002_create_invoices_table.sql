-- Create invoices table for Phase 1
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  invoice_number text unique not null,
  customer_name text not null,
  amount decimal(10,2) not null,
  status text default 'pending' check (status in ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  due_date date not null,
  issue_date date default current_date,
  payment_method text,
  payment_date date,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.invoices enable row level security;

-- Create policies
create policy "Allow all access to invoices" on public.invoices
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_invoices_updated_at
  before update on public.invoices
  for each row execute function public.update_updated_at_column();

-- Create invoice number sequence
create sequence if not exists invoice_number_seq start 1001;

