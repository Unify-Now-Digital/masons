import { describe, it, expect, vi } from 'vitest';
vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }));
import { pickLeadSource } from './addToPipeline.api';

describe('pickLeadSource', () => {
  it('explicit choice wins', () => expect(pickLeadSource('Referral', 'Google Ads')).toBe('Referral'));
  it('falls back to the enquiry source', () => expect(pickLeadSource('', 'ppc')).toBe('Google Ads'));
  it('null when neither is known', () => expect(pickLeadSource(null, null)).toBeNull());
});
