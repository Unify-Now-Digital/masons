-- Proof workflow hardening & gap fixes on top of 20260413120000.
-- 1) Close the enumeration hole: anon can no longer SELECT rows directly;
--    instead they must go through a SECURITY DEFINER RPC that only returns
--    the row matching their token (the token itself is not guessable).
-- 2) Guard approve_proof so it doesn't reset an order's proof_status if
--    lettering has already moved past.
-- 3) Auto-advance orders.proof_status to 'Received' whenever a new
--    inscription is created, so the workflow never skips that state.

-- ---------------------------------------------------------------------------
-- 1. Anon RLS: drop broad SELECT; add token-lookup RPC
-- ---------------------------------------------------------------------------
drop policy if exists "proof_revisions_anon_read_by_token" on public.proof_revisions;

create or replace function public.get_proof_by_token(p_token text)
returns public.proof_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.proof_revisions;
begin
  if p_token is null or length(p_token) = 0 then
    return null;
  end if;

  select * into v_revision
    from public.proof_revisions
   where public_token = p_token;

  return v_revision;
end;
$$;

revoke all on function public.get_proof_by_token(text) from public;
grant execute on function public.get_proof_by_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Guard approve_proof: only advance orders.proof_status when still pre-lettering.
-- ---------------------------------------------------------------------------
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

  update public.inscriptions
     set status = 'approved',
         updated_at = now()
   where id = v_revision.inscription_id;

  -- Only advance orders that haven't already moved into or past lettering.
  if v_revision.order_id is not null then
    update public.orders
       set proof_status = 'Lettered',
           updated_at = now()
     where id = v_revision.order_id
       and proof_status in ('NA','Not_Received','Received','In_Progress');
  end if;

  return v_revision;
end;
$$;

revoke all on function public.approve_proof(text, text) from public;
grant execute on function public.approve_proof(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Auto-advance orders.proof_status to 'Received' on inscription insert.
--    Keeps the workflow honest: an order with an inscription can never be
--    left at 'NA' or 'Not_Received'.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_inscription_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_id is not null then
    update public.orders
       set proof_status = 'Received',
           updated_at = now()
     where id = new.order_id
       and proof_status in ('NA','Not_Received');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inscriptions_mark_received on public.inscriptions;
create trigger trg_inscriptions_mark_received
  after insert on public.inscriptions
  for each row execute function public.mark_order_inscription_received();

-- Also fire on order_id reassignment so re-linking an inscription advances
-- the newly-linked order into the workflow.
drop trigger if exists trg_inscriptions_reassign_mark_received on public.inscriptions;
create trigger trg_inscriptions_reassign_mark_received
  after update of order_id on public.inscriptions
  for each row
  when (new.order_id is distinct from old.order_id)
  execute function public.mark_order_inscription_received();
