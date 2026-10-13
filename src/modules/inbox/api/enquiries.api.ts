import { supabase } from '@/shared/lib/supabase';
import type { Json } from '@/shared/types/database.types';

export type QuoteEnquiryRow = { id: string; created_at: string; details: Json | null };

/**
 * A person's quote-channel enquiries, newest first (inbox enquiry card). Org-guarded here,
 * not only by RLS. Statuses live are new/resolved only, so no status filter (2026-10-13).
 */
export async function fetchQuoteEnquiriesByPersonId(
  personId: string,
  organizationId: string
): Promise<QuoteEnquiryRow[]> {
  const { data, error } = await supabase
    .from('enquiries')
    .select('id, created_at, details')
    .eq('person_id', personId)
    .eq('organization_id', organizationId)
    .eq('channel', 'quote')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as QuoteEnquiryRow[];
}
