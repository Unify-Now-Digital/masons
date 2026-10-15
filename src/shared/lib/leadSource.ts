/**
 * Lead attribution vocab (Arin, 15 Oct 2026). Two separate questions:
 *  - lead_source  = WHY they came  (Google Ads, Organic, Funeral director, Referral, Repeat, Unknown)
 *  - lead_channel = HOW they reached us (Contact form, RAQ, Brochure, Web chat, Call, Email)
 * DB: enquiries.lead_source / lead_channel and jobs.lead_source / lead_channel, check-constrained
 * by migration 20261015095256. NB enquiries.channel is the web form kind (quote/contact/…), not this.
 */
export const LEAD_SOURCES = ['Google Ads', 'Organic', 'Funeral director', 'Referral', 'Repeat', 'Unknown'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_CHANNELS = ['Contact form', 'RAQ', 'Brochure', 'Web chat', 'Call', 'Email'] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

/** Same mapping as public.normalize_lead_source(): legacy picklist values → new vocab. */
export function normalizeLeadSource(v: string | null | undefined): LeadSource | null {
  if (v == null || !v.trim()) return null;
  if ((LEAD_SOURCES as readonly string[]).includes(v)) return v as LeadSource;
  if (/^(fd|funeral)/i.test(v)) return 'Funeral director';
  if (/^(returning|repeat)/i.test(v)) return 'Repeat';
  if (/referr/i.test(v)) return 'Referral';
  if (/^(google ads|ads|ppc|cpc)$/i.test(v)) return 'Google Ads';
  if (/^organic/i.test(v)) return 'Organic';
  return 'Unknown';
}

/** Same mapping as public.normalize_lead_channel(). */
export function normalizeLeadChannel(v: string | null | undefined): LeadChannel | null {
  if (v == null || !v.trim()) return null;
  if ((LEAD_CHANNELS as readonly string[]).includes(v)) return v as LeadChannel;
  if (/^(quote|raq|request a quote)/i.test(v)) return 'RAQ';
  if (/^(contact|shortlist|web form)/i.test(v)) return 'Contact form';
  if (/brochure/i.test(v)) return 'Brochure';
  if (/chat/i.test(v)) return 'Web chat';
  if (/^(call|phone|yopa)/i.test(v)) return 'Call';
  if (/^e-?mail/i.test(v)) return 'Email';
  return null;
}

/** Best guess of the source for a manually added conversation; the user can change it. */
export function suggestLeadSource(_channel: string | null | undefined): LeadSource | '' {
  return '';
}

/** Channel from an inbox conversation channel (email / phone / webchat …). */
export function suggestLeadChannel(channel: string | null | undefined): LeadChannel | null {
  switch (channel) {
    case 'email': return 'Email';
    case 'phone': case 'call': case 'voice': return 'Call';
    case 'webchat': case 'chat': case 'live_chat': return 'Web chat';
    default: return null;
  }
}

/** Channel from the web form kind in enquiries.channel. */
export function channelFromEnquiryKind(kind: string | null | undefined): LeadChannel | null {
  switch (kind) {
    case 'quote': return 'RAQ';
    case 'contact': case 'shortlist': return 'Contact form';
    case 'call': return 'Call';
    default: return null;
  }
}

/** Web attribution: a Google click ID (or utm google/cpc) wins; mirrors create_quote. */
export function webLeadSource(a: { gclid?: string | null; gbraid?: string | null; wbraid?: string | null; utm_source?: string | null; utm_medium?: string | null }): LeadSource {
  if (a.gclid || a.gbraid || a.wbraid) return 'Google Ads';
  if (/^google$/i.test(a.utm_source ?? '') && /^(cpc|ppc|paid)/i.test(a.utm_medium ?? '')) return 'Google Ads';
  return 'Unknown';
}

/** Job value first, then its enquiry; null = not recorded. */
export function resolveAttribution(
  job: { lead_source?: string | null; lead_channel?: string | null } | null | undefined,
  enquiry?: { lead_source?: string | null; lead_channel?: string | null; channel?: string | null } | null,
): { source: LeadSource | null; channel: LeadChannel | null } {
  return {
    source: normalizeLeadSource(job?.lead_source) ?? normalizeLeadSource(enquiry?.lead_source),
    channel: normalizeLeadChannel(job?.lead_channel) ?? normalizeLeadChannel(enquiry?.lead_channel) ?? channelFromEnquiryKind(enquiry?.channel),
  };
}
