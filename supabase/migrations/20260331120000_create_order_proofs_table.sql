-- ============================================================
-- Migration: create_order_proofs_table
-- Apply via: Supabase dashboard → SQL editor
-- ============================================================

create table if not exists public.order_proofs (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,

  -- Generation inputs
  inscription_text        text not null,
  stone_photo_url         text not null,
  font_style              text,
  additional_instructions text,

  -- Render outputs
  render_url              text,
  render_method           text not null default 'ai_image'
                            check (render_method in ('ai_image', 'canvas_composite', 'manual_upload')),
  render_provider         text,
  render_meta             jsonb,

  -- Lifecycle state
  state                   text not null default 'not_started'
                            check (state in (
                              'not_started',
                              'generating',
                              'draft',
                              'sent',
                              'approved',
                              'changes_requested',
                              'failed'
                            )),
  last_error              text,

  -- Send tracking
  sent_via                text check (sent_via in ('email', 'whatsapp', 'both')),
  sent_at                 timestamptz,
  inbox_conversation_id   uuid references public.inbox_conversations(id) on delete set null,

  -- Approval
  approved_at             timestamptz,
  approved_by             text check (approved_by in ('staff_manual', 'customer_email', 'customer_whatsapp')),

  -- Change request
  changes_requested_at    timestamptz,
  changes_note            text,

  -- Audit
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Indexes
create index if not exists idx_order_proofs_order_id on public.order_proofs (order_id);
create index if not exists idx_order_proofs_user_id  on public.order_proofs (user_id);
create index if not exists idx_order_proofs_state    on public.order_proofs (state);

-- updated_at trigger (reuses the update_updated_at_column function already in this project)
create trigger update_order_proofs_updated_at
  before update on public.order_proofs
  for each row
  execute function public.update_updated_at_column();

-- RLS
alter table public.order_proofs enable row level security;

drop policy if exists "Users can select own order_proofs" on public.order_proofs;
create policy "Users can select own order_proofs"
  on public.order_proofs for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own order_proofs" on public.order_proofs;
create policy "Users can insert own order_proofs"
  on public.order_proofs for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own order_proofs" on public.order_proofs;
create policy "Users can update own order_proofs"
  on public.order_proofs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
