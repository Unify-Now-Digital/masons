-- Scope down overly broad anon RLS policies discovered in the 2026-04-26 audit.
-- The custom session-based auth requires anon to INSERT (create login/token) and
-- SELECT (validate it), but never UPDATE or DELETE. The previous policies granted
-- ALL operations to anon, which is unsafe.

-- password_reset_tokens
DROP POLICY IF EXISTS "allow_anon_password_reset_tokens" ON public.password_reset_tokens;

CREATE POLICY "anon_insert_password_reset_tokens"
  ON public.password_reset_tokens FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_password_reset_tokens"
  ON public.password_reset_tokens FOR SELECT TO anon
  USING (true);

-- admin_sessions
DROP POLICY IF EXISTS "allow_anon_admin_sessions" ON public.admin_sessions;

CREATE POLICY "anon_insert_admin_sessions"
  ON public.admin_sessions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_admin_sessions"
  ON public.admin_sessions FOR SELECT TO anon
  USING (true);

-- partner_sessions
DROP POLICY IF EXISTS "allow_anon_partner_sessions" ON public.partner_sessions;

CREATE POLICY "anon_insert_partner_sessions"
  ON public.partner_sessions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_partner_sessions"
  ON public.partner_sessions FOR SELECT TO anon
  USING (true);

-- partners (anon only needs to look up partner during login)
DROP POLICY IF EXISTS "allow_anon_partners" ON public.partners;

CREATE POLICY "anon_select_partners"
  ON public.partners FOR SELECT TO anon
  USING (true);
