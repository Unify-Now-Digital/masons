-- Feature 016 — Org-level Gmail connections
-- T007: make email SELECT/UPDATE RLS org-scoped on inbox_conversations + inbox_messages.
--
-- WHY: today these two tables' SELECT and UPDATE policies (role public) use
--   CASE WHEN channel = 'email' THEN (user_id = auth.uid())
--        ELSE user_is_member_of_org(organization_id) END
-- i.e. EMAIL is gated per-user at the DB layer, so non-connector org members cannot see the
-- org's email threads. INSERT/DELETE are already org-scoped. We change ONLY the email arm.
--
-- HOW: ALTER POLICY (in-place expression change) — same policy name, same role (public), same
-- command. The new expression is `user_is_member_of_org(organization_id)`, which is BYTE-IDENTICAL
-- to the CASE's existing ELSE (non-email) arm. Therefore non-email channels (whatsapp, sms, …)
-- behave EXACTLY as before; only email flips from per-user to org-scoped.
--
-- SAFETY: verified 2026-07-03 that 0 email rows have a null organization_id (both tables), so no
-- row becomes hidden by the swap. Step 0 re-checks this at run time — DO NOT proceed if it is not 0/0.
--
-- ⚠️ Dashboard auto-commits each statement. Run TOP TO BOTTOM, one statement at a time, and confirm
-- the EXPECT note before running the next. LIVE Churchill email data is affected.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 (RUN-GATE — safety precondition). Must be 0 and 0. If not, STOP: the swap would hide
-- those null-org email rows. Do not run any ALTER below.
select
  (select count(*) from public.inbox_conversations where channel = 'email' and organization_id is null) as conv_email_null_org,
  (select count(*) from public.inbox_messages       where channel = 'email' and organization_id is null) as msg_email_null_org;
-- ✅ EXPECT: conv_email_null_org = 0, msg_email_null_org = 0.  (If either > 0 → STOP.)

-- ─────────────────────────────────────────────────────────────────────────────
-- inbox_conversations — SELECT
-- STEP 1 (verify current). Confirm the CASE/email-per-user expression is present before altering.
select cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='inbox_conversations' and policyname='inbox_conversations_org_select';
-- ✅ EXPECT: cmd=SELECT, roles={public}, qual contains
--    CASE WHEN (channel = 'email') THEN (user_id = auth.uid()) ELSE user_is_member_of_org(organization_id) END

-- STEP 2 (alter). Collapse to org-scoped (= the existing ELSE arm; email arm changes only).
alter policy inbox_conversations_org_select on public.inbox_conversations
  using (public.user_is_member_of_org(organization_id));

-- STEP 3 (verify result).
select cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='inbox_conversations' and policyname='inbox_conversations_org_select';
-- ✅ EXPECT: qual = user_is_member_of_org(organization_id)  (no CASE, no user_id / auth.uid()).

-- ─────────────────────────────────────────────────────────────────────────────
-- inbox_conversations — UPDATE (has both USING and WITH CHECK)
-- STEP 4 (verify current).
select cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='inbox_conversations' and policyname='inbox_conversations_org_update';
-- ✅ EXPECT: cmd=UPDATE, roles={public}, qual AND with_check both the CASE/email-per-user expression.

-- STEP 5 (alter).
alter policy inbox_conversations_org_update on public.inbox_conversations
  using (public.user_is_member_of_org(organization_id))
  with check (public.user_is_member_of_org(organization_id));

-- STEP 6 (verify result).
select cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='inbox_conversations' and policyname='inbox_conversations_org_update';
-- ✅ EXPECT: qual = with_check = user_is_member_of_org(organization_id)  (no CASE).

-- ─────────────────────────────────────────────────────────────────────────────
-- inbox_messages — SELECT
-- STEP 7 (verify current).
select cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='inbox_messages' and policyname='inbox_messages_org_select';
-- ✅ EXPECT: cmd=SELECT, roles={public}, qual = the CASE/email-per-user expression.

-- STEP 8 (alter).
alter policy inbox_messages_org_select on public.inbox_messages
  using (public.user_is_member_of_org(organization_id));

-- STEP 9 (verify result).
select cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='inbox_messages' and policyname='inbox_messages_org_select';
-- ✅ EXPECT: qual = user_is_member_of_org(organization_id)  (no CASE).

-- ─────────────────────────────────────────────────────────────────────────────
-- inbox_messages — UPDATE
-- STEP 10 (verify current).
select cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='inbox_messages' and policyname='inbox_messages_org_update';
-- ✅ EXPECT: cmd=UPDATE, roles={public}, qual AND with_check both the CASE/email-per-user expression.

-- STEP 11 (alter).
alter policy inbox_messages_org_update on public.inbox_messages
  using (public.user_is_member_of_org(organization_id))
  with check (public.user_is_member_of_org(organization_id));

-- STEP 12 (verify result).
select cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='inbox_messages' and policyname='inbox_messages_org_update';
-- ✅ EXPECT: qual = with_check = user_is_member_of_org(organization_id)  (no CASE).

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 13 (final verify — all 4 policies org-scoped, non-email untouched).
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname='public'
  and tablename in ('inbox_conversations','inbox_messages')
  and cmd in ('SELECT','UPDATE')
order by tablename, cmd;
-- ✅ EXPECT: all four quals = user_is_member_of_org(organization_id); no CASE / user_id / auth.uid().
-- INSERT/DELETE policies were not touched and remain org-scoped on {authenticated}.

-- ROLLBACK (if ever needed): restore the CASE on each of the 4 policies, e.g.
--   alter policy inbox_conversations_org_select on public.inbox_conversations
--     using (case when channel = 'email' then (user_id = auth.uid())
--                 else public.user_is_member_of_org(organization_id) end);
--   (repeat with with_check for the two UPDATE policies).
