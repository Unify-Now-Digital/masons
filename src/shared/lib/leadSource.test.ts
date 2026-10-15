import { describe, expect, it } from 'vitest';
import { LEAD_CHANNELS, LEAD_SOURCES, normalizeLeadChannel, normalizeLeadSource, resolveAttribution, suggestLeadChannel, webLeadSource } from './leadSource';

describe('lead attribution vocab', () => {
  it('lists the approved options', () => {
    expect(LEAD_SOURCES).toEqual(['Google Ads', 'Organic', 'Funeral director', 'Referral', 'Repeat', 'Unknown']);
    expect(LEAD_CHANNELS).toEqual(['Contact form', 'RAQ', 'Brochure', 'Web chat', 'Call', 'Email']);
  });
  it('maps legacy picklist values like the SQL normaliser', () => {
    expect(normalizeLeadSource('FD referral')).toBe('Funeral director');
    expect(normalizeLeadSource('Web form')).toBe('Unknown');
    expect(normalizeLeadSource('Returning customer')).toBe('Repeat');
    expect(normalizeLeadSource('')).toBeNull();
    expect(normalizeLeadChannel('quote')).toBe('RAQ');
    expect(normalizeLeadChannel('chat widget')).toBe('Web chat');
    expect(normalizeLeadChannel('Phone/YOPA')).toBe('Call');
  });
  it('suggests channel from the conversation', () => {
    expect(suggestLeadChannel('email')).toBe('Email');
    expect(suggestLeadChannel('whatsapp')).toBeNull();
  });
  it('attributes web leads', () => {
    expect(webLeadSource({ gclid: 'x' })).toBe('Google Ads');
    expect(webLeadSource({ gbraid: 'x' })).toBe('Google Ads');
    expect(webLeadSource({ utm_source: 'google', utm_medium: 'cpc' })).toBe('Google Ads');
    expect(webLeadSource({})).toBe('Unknown');
  });
  it('job wins over enquiry; form kind is the last channel fallback', () => {
    expect(resolveAttribution({ lead_source: 'Repeat' }, { lead_source: 'Google Ads', channel: 'quote' })).toEqual({ source: 'Repeat', channel: 'RAQ' });
    expect(resolveAttribution(null, null)).toEqual({ source: null, channel: null });
  });
});
