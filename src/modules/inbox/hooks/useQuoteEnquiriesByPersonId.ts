import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchQuoteEnquiriesByPersonId } from '../api/enquiries.api';
import { parseQuoteEnquiry, type QuoteEnquiryView } from '../utils/enquiryDetails';

export type QuoteEnquiry = QuoteEnquiryView & { createdAt: string };

export const quoteEnquiriesKeys = {
  byPerson: (personId: string, organizationId: string) =>
    ['inbox', 'quote-enquiries', personId, organizationId] as const,
};

/**
 * Parsed quote enquiries for one person, newest first. Rows without a product name are
 * dropped (parseQuoteEnquiry → null). Written only by the portal, so no Mason mutation
 * invalidates this key; refetch-on-focus refreshes it.
 */
export function useQuoteEnquiriesByPersonId(personId: string | null | undefined) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      personId && organizationId
        ? quoteEnquiriesKeys.byPerson(personId, organizationId)
        : ['inbox', 'quote-enquiries', 'disabled'],
    queryFn: async (): Promise<QuoteEnquiry[]> => {
      const rows = await fetchQuoteEnquiriesByPersonId(personId!, organizationId!);
      return rows.flatMap((row) => {
        const view = parseQuoteEnquiry(row);
        return view ? [{ ...view, createdAt: row.created_at }] : [];
      });
    },
    enabled: !!personId && !!organizationId,
  });
}
