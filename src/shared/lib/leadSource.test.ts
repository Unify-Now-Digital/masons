import { describe, expect, it } from 'vitest';
import { LEAD_SOURCES, suggestLeadSource, webLeadSource } from './leadSource';

describe('lead sources', () => {
  it('lists the approved options', () => {
    expect(LEAD_SOURCES).toEqual(['Phone/YOPA', 'FD referral', 'Brochure', 'Google Ads', 'Web form', 'Email', 'Walk-in', 'Other']);
  });
  it('suggests from channel', () => {
    expect(suggestLeadSource('email')).toBe('Email');
    expect(suggestLeadSource('whatsapp')).toBe('');
  });
  it('attributes web leads', () => {
    expect(webLeadSource({ gclid: 'x' })).toBe('Google Ads');
    expect(webLeadSource({ utm_source: 'google', utm_medium: 'cpc' })).toBe('Google Ads');
    expect(webLeadSource({ utm_source: 'facebook' })).toBe('Web form');
    expect(webLeadSource({})).toBe('Web form');
  });
});
