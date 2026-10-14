/** Lead sources recorded on enquiries / pipeline jobs (approved 15 Oct 2026). */
export const LEAD_SOURCES = [
  'Phone/YOPA',
  'FD referral',
  'Brochure',
  'Google Ads',
  'Web form',
  'Email',
  'Walk-in',
  'Other',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Best guess for a conversation's channel; the user can change it. */
export function suggestLeadSource(channel: string | null | undefined): LeadSource | '' {
  switch (channel) {
    case 'email':
      return 'Email';
    case 'web':
    case 'website':
    case 'enquiry':
      return 'Web form';
    default:
      return '';
  }
}

/**
 * Web-form attribution: Google Ads click (gclid) wins, else utm_source, else
 * plain web form. Mirrors the server-side rule in create_quote.
 */
export function webLeadSource(a: { gclid?: string | null; utm_source?: string | null; utm_medium?: string | null }): LeadSource {
  if (a.gclid) return 'Google Ads';
  if (/^google$/i.test(a.utm_source ?? '') && /^(cpc|ppc|paid)/i.test(a.utm_medium ?? '')) return 'Google Ads';
  return 'Web form';
}
