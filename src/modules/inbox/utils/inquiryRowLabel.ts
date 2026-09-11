/** Locked lead labels for non-customer inbox rows (Arin Sep 2026). */
export type InquiryRowLabel =
  | 'Customer'
  | 'Product / RAQ'
  | 'Additional work'
  | 'Contact form'
  | 'Appointment'
  | 'Call request'
  | 'Shortlist'
  | 'Web chat / GHL';

export interface EnquiryLabelSource {
  channel: string;
  sub_type: string | null;
  source_page: string | null;
}

/**
 * Map a Supabase `enquiries` row to a lead label, or null if unknown.
 * Covers every portal channel (quote, appointment, call, contact, shortlist);
 * anything else returns null so the caller's default applies.
 */
export function labelFromEnquiry(e: EnquiryLabelSource): Exclude<InquiryRowLabel, 'Customer'> | null {
  const ch = (e.channel || '').toLowerCase();
  const sub = (e.sub_type || '').toLowerCase();
  const page = (e.source_page || '').toLowerCase();
  if (ch === 'quote' || page.includes('/memorials')) return 'Product / RAQ';
  if (ch === 'contact' && sub === 'additional') return 'Additional work';
  if (ch === 'contact') return 'Contact form';
  if (ch === 'appointment') return 'Appointment';
  if (ch === 'call') return 'Call request';
  if (ch === 'shortlist') return 'Shortlist';
  return null;
}

/** Resolve the chip text for a customer-thread row. */
export function inquiryRowLabel(opts: {
  isCustomer: boolean;
  enquiry: EnquiryLabelSource | null | undefined;
}): InquiryRowLabel {
  if (opts.isCustomer) return 'Customer';
  const fromEnquiry = opts.enquiry ? labelFromEnquiry(opts.enquiry) : null;
  if (fromEnquiry) return fromEnquiry;
  // Inbox web / GHL / no enquiry row — default lead label.
  return 'Web chat / GHL';
}
