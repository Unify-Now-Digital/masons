-- Round-3 hardening on the proof workflow:
-- - approve_proof now syncs inscriptions.inscription_text from the approved
--   proof's lines so the canonical record matches what the customer signed.
-- (Token-stickiness across revisions is handled client-side; no schema change.)

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
  v_text text;
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

  -- Derive the final inscription text from the approved lines, preserving order.
  select string_agg(elem->>'text', E'\n' order by ord)
    into v_text
    from jsonb_array_elements(v_revision.lines) with ordinality as t(elem, ord);

  update public.inscriptions
     set status = 'approved',
         inscription_text = coalesce(nullif(v_text, ''), inscription_text),
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
