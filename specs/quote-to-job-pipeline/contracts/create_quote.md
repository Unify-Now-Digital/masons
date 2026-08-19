# Contract: public.create_quote(payload jsonb) → jsonb

The only RPC whose behavior changes this cycle. Caller: SearsMelvin portal worker (Cloudflare
Pages Function, service key, RLS bypassed — isolation lives inside this SQL).

## Signature — UNCHANGED

```sql
create or replace function public.create_quote(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
```

- `CREATE OR REPLACE` preserves owner + ACL (service_role-only, verified at f683e4c). Re-verify
  ACL in read-back anyway (protocol).
- Input payload shape: unchanged. All keys read today remain read (`organization_id`, `email`,
  `first_name`, `last_name`, `phone`, `name`, `message`, `source_page`, `location`,
  `cemetery_id`, `edit_token`, `product`).

## Behavior — changed

| Step | Old | New |
|------|-----|-----|
| 1. Person upsert | org-scoped dedupe (f683e4c) | **identical, verbatim** (FR-002) |
| 2. Cemetery resolve | id else name-ilike | unchanged |
| 3. Orders INSERT | `order_type='quote'` row | **REMOVED** (FR-001) |
| 3'. Job resolve/create | — | active job at `'enquired'` for (person, org) → reuse; else INSERT job (`source 'website'`, `stage 'enquired'`, `stage_status 'uncontacted'`) (FR-004) |
| 4. Enquiries INSERT | with `order_id` | **without** `order_id`; `details = v_product` unchanged |
| 5. Job attach | — | UPDATE job: `enquiry_id = v_enq_id`; `conversation_id = coalesce(conversation_id, (select id from inbox_conversations where external_thread_id = 'enquiry:' \|\| v_enq_id and organization_id = v_org))` |

Forward-dedupe SELECT (step 3') must be org-guarded and active-only:

```sql
select id into v_job_id from public.jobs
where person_id = v_person_id
  and organization_id = v_org
  and stage = 'enquired'
  and exit_reason is null
order by created_at desc
limit 1;
```

Jobs at any later stage never match (decided: fresh quote from someone in production = new
memorial = new job).

## Return shape — compatibility-preserving (research F2)

```jsonc
{
  "person_id":  "<uuid>",
  "order_id":   null,        // key KEPT, value now always null (worker may destructure it)
  "enquiry_id": "<uuid>",
  "edit_token": "<echoed>",  // key KEPT; token no longer persisted anywhere (capture trigger starved)
  "job_id":     "<uuid>"     // NEW
}
```

Rationale: the portal worker's submit-path consumption of the return object cannot be read from
this workspace (SearsMelvin repo). Keeping legacy keys with null/echo values makes the rewrite
non-breaking for any plausible destructuring; the only accepted breakage remains the edit-link
404 (documented, Arin warned).

## Error contract — unchanged

- `email` missing/empty → `raise exception 'create_quote: email is required'`.
- All other failures propagate as before (worker already handles RPC errors).

## Client (Mason frontend) impact

None. Mason never calls `create_quote`; it is portal-only.
