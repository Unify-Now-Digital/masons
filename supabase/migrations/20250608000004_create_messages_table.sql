-- Create messages table for Phase 1 (unified inbox - manual messages only)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  thread_id uuid,
  type text default 'email' check (type in ('email', 'phone', 'note', 'internal')),
  direction text default 'inbound' check (direction in ('inbound', 'outbound')),
  from_name text not null,
  from_email text,
  from_phone text,
  subject text,
  content text not null,
  is_read boolean default false,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.messages enable row level security;

-- Create policies
create policy "Allow all access to messages" on public.messages
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_messages_updated_at
  before update on public.messages
  for each row execute function public.update_updated_at_column();

-- Create index for thread lookups
create index if not exists idx_messages_thread_id on public.messages(thread_id);
create index if not exists idx_messages_order_id on public.messages(order_id);

