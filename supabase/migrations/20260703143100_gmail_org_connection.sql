-- Feature 016 — Org-level Gmail connections
-- T008: (1) swap the per-USER active-connection unique index for a per-ORG one (destructive, guarded),
--       (2) create the additive oauth_state table backing the admin-gated OAuth connect flow.
--
-- ⚠️ Dashboard auto-commits each statement. Run TOP TO BOTTOM, one statement at a time, confirming the
-- EXPECT note before the next. LIVE Churchill data. The only destructive step is STEP 4 (DROP INDEX),
-- gated by STEPs 1–3.

-- ═════════════════════════════════════════════════════════════════════════════
-- PART A — one active connection per org (drop per-user index → add per-org index)
-- ═════════════════════════════════════════════════════════════════════════════

-- STEP 1 (RUN-GATE — precondition). Active rows must all carry an org.
select count(*) as active_null_org
from public.gmail_connections
where status = 'active' and organization_id is null;
-- ✅ EXPECT: active_null_org = 0.  (If > 0 → STOP: the per-org partial unique index needs a non-null org.)

-- STEP 2 (RUN-GATE — precondition). No org may already have >1 active row.
select organization_id, count(*) as active_count
from public.gmail_connections
where status = 'active' and organization_id is not null
group by organization_id
having count(*) > 1;
-- ✅ EXPECT: 0 rows returned.  (If any row → STOP: dedupe with maintainer approval before the index.)

-- STEP 3 (verify current index exists before dropping).
select indexname from pg_indexes
where schemaname='public' and tablename='gmail_connections'
  and indexname='idx_gmail_connections_one_active_per_user';
-- ✅ EXPECT: 1 row (idx_gmail_connections_one_active_per_user). If 0 rows, it was already dropped — skip STEP 4.

-- STEP 4 (DESTRUCTIVE). Drop the per-user active-connection unique index.
drop index if exists public.idx_gmail_connections_one_active_per_user;

-- STEP 5 (verify dropped).
select indexname from pg_indexes
where schemaname='public' and tablename='gmail_connections'
  and indexname='idx_gmail_connections_one_active_per_user';
-- ✅ EXPECT: 0 rows.

-- STEP 6 (create per-org partial unique index — one active connection per organization).
create unique index idx_gmail_connections_one_active_per_org
  on public.gmail_connections (organization_id)
  where status = 'active';

-- STEP 7 (verify created + invariant holds).
select
  (select count(*) from pg_indexes
     where schemaname='public' and tablename='gmail_connections'
       and indexname='idx_gmail_connections_one_active_per_org') as new_index_present,
  (select coalesce(max(c),0) from (
       select count(*) c from public.gmail_connections
       where status='active' group by organization_id) s) as max_active_per_org;
-- ✅ EXPECT: new_index_present = 1, max_active_per_org = 1.

-- ═════════════════════════════════════════════════════════════════════════════
-- PART B — oauth_state (additive): single-use, short-lived nonce binding the OAuth callback
-- identity server-side. Written by gmail-oauth-start (service role), consumed by gmail-oauth-callback.
-- Prevents the unsigned-state connection-hijack (pentest OPEN/HIGH). Not client-accessible.
-- ═════════════════════════════════════════════════════════════════════════════

-- STEP 8 (verify absent before creating).
select to_regclass('public.oauth_state') as oauth_state_regclass;
-- ✅ EXPECT: oauth_state_regclass = NULL (table does not exist yet). If already present, skip STEP 9.

-- STEP 9 (create table — additive).
create table if not exists public.oauth_state (
  nonce           text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- STEP 10 (index for expiry pruning — additive).
create index if not exists idx_oauth_state_expires_at on public.oauth_state (expires_at);

-- STEP 11 (enable RLS — deny-all to authenticated/anon; only service-role edge functions touch it).
alter table public.oauth_state enable row level security;

-- STEP 12 (documentation).
comment on table public.oauth_state is
  'Single-use, short-lived nonce binding OAuth callback identity server-side; written by gmail-oauth-start, consumed by gmail-oauth-callback. No RLS policies by design (service-role only); not client-accessible.';

-- STEP 13 (final verify).
select
  to_regclass('public.oauth_state')                                            as regclass_present,   -- expect public.oauth_state
  (select relrowsecurity from pg_class where relname='oauth_state')             as rls_enabled,        -- expect true
  (select count(*) from pg_policies where schemaname='public' and tablename='oauth_state') as policy_count,  -- expect 0
  (select count(*) from public.oauth_state)                                     as row_count;          -- expect 0
-- ✅ EXPECT: regclass_present = public.oauth_state, rls_enabled = true, policy_count = 0, row_count = 0.

-- ROLLBACK (if ever needed):
--   drop index if exists public.idx_gmail_connections_one_active_per_org;
--   create unique index idx_gmail_connections_one_active_per_user
--     on public.gmail_connections (user_id) where status='active';
--   drop table if exists public.oauth_state;
