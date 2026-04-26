-- Add the 14 missing foreign-key indexes flagged by the 2026-04-26 performance audit.
--
-- Note: the audit recommended CREATE INDEX CONCURRENTLY, but Supabase migrations
-- run inside a transaction and CONCURRENTLY is incompatible with that. At current
-- scale the audit confirms tables are small enough that a regular CREATE INDEX
-- will not cause noticeable locking. If a table grows large before this is applied,
-- run that single index manually via execute_sql with CONCURRENTLY instead.

-- High priority: organization_id (used in every multi-tenant query)
CREATE INDEX IF NOT EXISTS idx_companies_organization_id
  ON public.companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbox_ai_suggestions_organization_id
  ON public.inbox_ai_suggestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbox_ai_thread_summaries_organization_id
  ON public.inbox_ai_thread_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id
  ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_organization_id
  ON public.quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connection_events_organization_id
  ON public.whatsapp_connection_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_organization_id
  ON public.whatsapp_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_managed_connections_organization_id
  ON public.whatsapp_managed_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_user_preferences_organization_id
  ON public.whatsapp_user_preferences(organization_id);

-- Medium priority: relationship indexes
CREATE INDEX IF NOT EXISTS idx_memorials_order_id
  ON public.memorials(order_id);
CREATE INDEX IF NOT EXISTS idx_order_proofs_inbox_conversation_id
  ON public.order_proofs(inbox_conversation_id);
CREATE INDEX IF NOT EXISTS idx_partner_comments_partner_id
  ON public.partner_comments(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_partner_id
  ON public.partner_sessions(partner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_revised_from_invoice_id
  ON public.invoices(revised_from_invoice_id);
