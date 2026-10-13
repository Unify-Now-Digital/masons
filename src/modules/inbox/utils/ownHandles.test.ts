import { describe, expect, it } from 'vitest';
import { buildOwnHandles, isOwnHandle, OWN_EMAIL_DOMAINS, ownHandleKeepFilter } from './ownHandles';

describe('buildOwnHandles / isOwnHandle', () => {
  const own = buildOwnHandles(['Info@Example.com ', 'whatsapp:+447700900123', null, '']);

  it('matches connected handles after normalization', () => {
    expect(isOwnHandle(' INFO@EXAMPLE.COM', own)).toBe(true);
    expect(isOwnHandle('+44 7700 900123', own)).toBe(true);
  });

  it('matches own domains and their subdomains, not lookalikes', () => {
    for (const domain of OWN_EMAIL_DOMAINS) {
      expect(isOwnHandle(`anyone@${domain}`, own)).toBe(true);
      expect(isOwnHandle(`anyone@lc.${domain}`, own)).toBe(true);
      expect(isOwnHandle(`anyone@not${domain}`, own)).toBe(false);
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

describe('ownHandleKeepFilter', () => {
  it('keeps linked rows; unlinked rows must miss every own pattern', () => {
    const filter = ownHandleKeepFilter(buildOwnHandles(['info@example.com', '+447700900123']));
    const domainMisses = OWN_EMAIL_DOMAINS.flatMap((d) => [
      `primary_handle.not.ilike."*@${d}"`,
      `primary_handle.not.ilike."*.${d}"`,
    ]);
    expect(filter).toBe(
      'person_id.not.is.null,and(' +
        ['primary_handle.not.ilike."info@example.com"', 'primary_handle.not.ilike."*7700900123"', ...domainMisses].join(',') +
        ')',
    );
  });

  it('LIKE-escapes and quotes handle values', () => {
    const filter = ownHandleKeepFilter(buildOwnHandles(['a_b%c@example.com', 'q"x@example.com']));
    expect(filter).toContain('primary_handle.not.ilike."a\\\\_b\\\\%c@example.com"');
    expect(filter).toContain('primary_handle.not.ilike."q\\"x@example.com"');
  });
});
