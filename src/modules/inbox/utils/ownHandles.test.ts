import { describe, expect, it } from 'vitest';
import { buildOwnHandles, isOwnHandle, OWN_EMAIL_DOMAINS } from './ownHandles';

describe('buildOwnHandles / isOwnHandle', () => {
  const own = buildOwnHandles(['Info@Example.com ', 'whatsapp:+447700900123', null, '']);

  it('matches connected handles after normalization', () => {
    expect(isOwnHandle(' INFO@EXAMPLE.COM', own)).toBe(true);
    expect(isOwnHandle('+44 7700 900123', own)).toBe(true);
  });

  it('matches own domains exactly, not their subdomains', () => {
    for (const domain of OWN_EMAIL_DOMAINS) {
      expect(isOwnHandle(`anyone@${domain}`, own)).toBe(true);
      expect(isOwnHandle(`anyone@lc.${domain}`, own)).toBe(false);
    }
  });

  it('does not match customers or empty handles', () => {
    expect(isOwnHandle('customer@example.org', own)).toBe(false);
    expect(isOwnHandle('', own)).toBe(false);
    expect(isOwnHandle(null, own)).toBe(false);
  });

  it('skips null and blank connected values', () => {
    expect(own.handles.size).toBe(2);
  });
});
