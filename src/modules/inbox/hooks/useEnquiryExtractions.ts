import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export type EnquiryOrderType =
  | 'new_memorial'
  | 'additional_inscription'
  | 'trade'
  | 'status_query'
  | 'quote';

export interface EnquiryExtractionRow {
  conversation_id: string;
  order_type: EnquiryOrderType | null;
  linked_order_id: string | null;
  cemetery_text: string | null;
  confidence: number | null;
}

const enquiryExtractionKeys = {
  byConversationIds: (ids: string[]) => ['inbox', 'enquiryExtractions', ids] as const,
};

async function fetchExtractions(conversationIds: string[]): Promise<EnquiryExtractionRow[]> {
  if (conversationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('inbox_enquiry_extraction')
    .select('conversation_id, order_type, linked_order_id, cemetery_text, confidence')
    .in('conversation_id', conversationIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as EnquiryExtractionRow[];
}

/**
 * Fetch the AI-extracted enquiry signals for a set of conversations.
 * Returns a stable map keyed by conversation_id.
 */
export function useEnquiryExtractions(conversationIds: string[]) {
  // Sort to keep cache key stable across reorderings.
  const stableIds = [...new Set(conversationIds)].filter(Boolean).sort();
  return useQuery({
    queryKey: enquiryExtractionKeys.byConversationIds(stableIds),
    queryFn: () => fetchExtractions(stableIds),
    enabled: stableIds.length > 0,
    staleTime: 60 * 1000,
  });
}
