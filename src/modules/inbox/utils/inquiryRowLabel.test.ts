import { describe, expect, it } from 'vitest';
import { inquiryRowLabel, labelFromEnquiry } from './inquiryRowLabel';

describe('labelFromEnquiry', () => {
  it('maps quote + memorials path to Product / RAQ', () => {
    expect(labelFromEnquiry({ channel: 'quote', sub_type: null, source_page: null })).toBe('Product / RAQ');
    expect(
      labelFromEnquiry({ channel: 'web', sub_type: null, source_page: '/memorials/the-castell' })
    ).toBe('Product / RAQ');
  });
  it('maps contact additional vs contact', () => {
    expect(
      labelFromEnquiry({ channel: 'contact', sub_type: 'additional', source_page: null })
    ).toBe('Additional work');
    expect(labelFromEnquiry({ channel: 'contact', sub_type: null, source_page: null })).toBe(
      'Contact form'
    );
  });
});

describe('inquiryRowLabel', () => {
  it('returns Customer for flagged people', () => {
    expect(
      inquiryRowLabel({
        isCustomer: true,
        enquiry: { channel: 'quote', sub_type: null, source_page: null },
      })
    ).toBe('Customer');
  });
  it('defaults non-customers without enquiry to Web chat / GHL', () => {
    expect(inquiryRowLabel({ isCustomer: false, enquiry: null })).toBe('Web chat / GHL');
  });
});
