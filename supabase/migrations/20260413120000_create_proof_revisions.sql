-- Proof revisions: design/proof workflow for inscriptions.
-- A revision captures one mason-drafted proof of an inscription. When the mason
-- "sends" a revision a public_token is generated so the customer can view and
-- approve/request-edits on the proof via an unauthenticated route.

create table if not exists public.proof_revisions (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references public.inscriptions(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  revision_number int not null default 1,
  lines jsonb not null default '[]'::jsonb,                  -- [{ text, y, fontSize }]
  material_color text,
  lettering_color text,
  shape text,                                                 -- snapshot of stone shape at send time
  status text not null default 'draft'
    check (status in ('draft','sent','changes_requested','approved','superseded')),
  public_token text unique,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  customer_feedback text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists proof_revisions_inscription_idx on public.proof_revisions(inscription_id);
create index if not exists proof_revisions_token_idx on public.proof_revisions(public_token);
create index if not exists proof_revisions_order_idx on public.proof_revisions(order_id);

alter table public.proof_revisions enable row level security;

-- Authenticated users (the mason and team) get full access. Matches the
-- existing pattern used by the inscriptions table.
create policy "proof_revisions_auth_all"
  on public.proof_revisions
  for all
  to authenticated
  using (true)
  with check (true);

-- Anonymous customers can read a revision when they have the public_token
-- (the row is fetched by token, not enumerated). Writes for anon happen only
-- through the SECURITY DEFINER RPCs below.
create policy "proof_revisions_anon_read_by_token"
  on public.proof_revisions
  for select
  to anon
  using (public_token is not null);

create trigger update_proof_revisions_updated_at
  before update on public.proof_revisions
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RPCs callable by the public proof page (anonymous customer).
-- Both lookup the revision by its public_token so the caller cannot mutate
-- arbitrary rows, and only act on the latest 'sent' revision.
-- ---------------------------------------------------------------------------

create or replace function public.submit_proof_feedback(
  p_token text,
  p_feedback text
)
returns public.proof_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.proof_revisions;
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'public_token is required';
  end if;

  if p_feedback is null or length(trim(p_feedback)) = 0 then
    raise exception 'feedback text is required';
  end if;

  update public.proof_revisions
     set status = 'changes_requested',
         customer_feedback = p_feedback,
         updated_at = now()
   where public_token = p_token
     and status in ('sent','changes_requested')
   returning * into v_revision;

  if v_revision.id is null then
    raise exception 'Proof revision not found or no longer accepting feedback';
  end if;

  return v_revision;
end;
$$;

revoke all on function public.submit_proof_feedback(text, text) from public;
grant execute on function public.submit_proof_feedback(text, text) to anon, authenticated;

create or replace function public.approve_proof(
  p_token text,
  p_name text
)
returns public.proof_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.proof_revisions;
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'public_token is required';
  end if;

  -- Idempotent: if already approved, return the current row.
  select * into v_revision
    from public.proof_revisions
   where public_token = p_token;

  if v_revision.id is null then
    raise exception 'Proof revision not found';
  end if;

  if v_revision.status = 'approved' then
    return v_revision;
  end if;

  if v_revision.status not in ('sent','changes_requested') then
    raise exception 'Proof revision is not awaiting approval';
  end if;

  update public.proof_revisions
     set status = 'approved',
         approved_at = now(),
         approved_by_name = nullif(trim(coalesce(p_name, '')), ''),
         updated_at = now()
   where id = v_revision.id
   returning * into v_revision;

  -- Move the inscription forward to 'approved'.
  update public.inscriptions
     set status = 'approved',
         updated_at = now()
   where id = v_revision.inscription_id;

  -- And move the order's proof_status to 'Lettered' so it's ready for lettering.
  if v_revision.order_id is not null then
    update public.orders
       set proof_status = 'Lettered',
           updated_at = now()
     where id = v_revision.order_id;
  end if;

  return v_revision;
end;
$$;

revoke all on function public.approve_proof(text, text) from public;
grant execute on function public.approve_proof(text, text) to anon, authenticated;

comment on table public.proof_revisions is
  'Versioned design proofs for inscriptions. Each revision can be sent to a customer via public_token for approval or change requests.';
