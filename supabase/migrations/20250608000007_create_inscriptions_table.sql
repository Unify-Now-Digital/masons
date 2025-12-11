-- Create inscriptions table for Phase 1
create table if not exists public.inscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  inscription_text text not null,
  type text not null check (type in ('front', 'back', 'side', 'plaque', 'additional')),
  style text,
  color text check (color in ('gold', 'silver', 'white', 'black', 'natural', 'other')),
  proof_url text,
  status text not null default 'pending' check (status in ('pending', 'proofing', 'approved', 'engraving', 'completed', 'installed')),
  engraved_by text,
  engraved_date date,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.inscriptions enable row level security;

-- Create policies
create policy "Allow all access to inscriptions" on public.inscriptions
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_inscriptions_updated_at
  before update on public.inscriptions
  for each row execute function public.update_updated_at_column();

