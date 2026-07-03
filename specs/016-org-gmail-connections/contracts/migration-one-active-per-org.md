# Contract: Migration — one active Gmail connection per org + `oauth_state`

**File**: `supabase/migrations/202607xxxxxxxx_gmail_org_connection.sql` (timestamp at authoring).
**Applied by**: maintainer, **Supabase Dashboard SQL editor**, statement-by-statement (auto-commit;
no wrapping txn), in **one session**. Show diff/output at each step. **Churchill is LIVE** — verify
before running.

Covers two changes in one sequence: (1) the destructive per-user→per-org unique index swap
(precondition-guarded), and (2) the additive `oauth_state` table backing the server-persisted
single-use nonce for admin-gated OAuth connect (see `gmail-oauth-connect.md`).

## Preconditions (must all hold; step 1 aborts if not)

- 0 rows with `status='active'` and `organization_id is null`.
- No `organization_id` has more than one `status='active'` row.
- (Informational) SM's `info@searsmelvin.co.uk` row is the single active row for SM's org;
  Churchill's single active row is Churchill's.

## Steps (run and verify in order)

**Step 1 — precondition guard (abort on violation)**
```sql
do $$
declare null_org int; dup int;
begin
  select count(*) into null_org
    from public.gmail_connections where status='active' and organization_id is null;
  select count(*) into dup from (
    select organization_id from public.gmail_connections
    where status='active' and organization_id is not null
    group by organization_id having count(*) > 1
  ) d;
  if null_org > 0 then
    raise exception 'Abort: % active gmail_connections with null organization_id', null_org;
  end if;
  if dup > 0 then
    raise exception 'Abort: % orgs with more than one active gmail_connections', dup;
  end if;
  raise notice 'Precondition OK: 0 null-org active, 0 duplicate-active orgs';
end $$;
```

**Step 2 — drop the per-user index**
```sql
drop index if exists public.idx_gmail_connections_one_active_per_user;
```

**Step 3 — create the per-org partial unique index**
```sql
create unique index idx_gmail_connections_one_active_per_org
  on public.gmail_connections (organization_id) where status = 'active';
```

**Step 4 — post-verify the index**
```sql
select organization_id, count(*)
from public.gmail_connections where status='active'
group by organization_id order by 2 desc;   -- expect max count = 1
```

**Step 5 — create `oauth_state` (additive; single-use nonce binding for OAuth connect)**
```sql
create table if not exists public.oauth_state (
  nonce text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_state_expires_at on public.oauth_state (expires_at);

alter table public.oauth_state enable row level security;
-- No authenticated policies: only service-role edge functions (gmail-oauth-start writes,
-- gmail-oauth-callback reads/consumes) touch this table. RLS enabled with zero policies = deny-all
-- to authenticated/anon, which is intended.
comment on table public.oauth_state is
  'Single-use, short-lived nonce binding OAuth callback identity server-side; written by gmail-oauth-start, consumed by gmail-oauth-callback. Not client-accessible.';
```

**Step 6 — post-verify `oauth_state`**
```sql
select count(*) from public.oauth_state;                     -- 0 on fresh table
select relrowsecurity from pg_class where relname='oauth_state';  -- expect true
```

## Non-goals / guards

- Do **not** add `NOT NULL` to `organization_id` (legacy `revoked` rows may be null).
- Do **not** delete any rows. Reconciliation is not needed in the happy path (preconditions hold);
  if step 1 aborts, stop and reconcile with maintainer approval before retrying.
- Reversible: `drop index …_one_active_per_org;` + recreate `…_one_active_per_user`.

## Acceptance

- Step 1 prints the OK notice against live data.
- Step 3 builds with no uniqueness violation.
- Step 4 shows every org with exactly one active row.
- Step 5 creates `oauth_state` with RLS enabled and no policies (deny-all to authenticated/anon).
- Maps to spec **FR-001, FR-002, FR-008, FR-012**; success criteria **SC-002, SC-005**.
