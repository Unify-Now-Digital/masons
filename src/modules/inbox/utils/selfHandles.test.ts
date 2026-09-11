import { describe, expect, it } from 'vitest';
import { buildSelfHandles, isSelfHandleGroup } from './selfHandles';

describe('buildSelfHandles', () => {
  it('includes gmail + connected channel accounts + whatsapp', () => {
    const set = buildSelfHandles({
      gmailAddress: 'Info@Example.com',
      whatsappFrom: '+447700900123',
      channelAccounts: [
        { account_identifier: 'hello@example.com', is_connected: true },
        { account_identifier: 'old@example.com', is_connected: false },
      ],
    });
    expect(set.has('info@example.com')).toBe(true);
    expect(set.has('hello@example.com')).toBe(true);
    expect(set.has('old@example.com')).toBe(false);
    expect(set.has('7700900123')).toBe(true); // last 10 digits
  });

  it('includes gmail regardless of connection status', () => {
    const set = buildSelfHandles({ gmailAddress: 'info@example.com' });
    expect(set.has('info@example.com')).toBe(true);
  });
});

describe('isSelfHandleGroup', () => {
  const self = new Set(['info@example.com']);
  it('matches unlinked handle keys', () => {
    expect(isSelfHandleGroup('h:info@example.com', self)).toBe(true);
  });
  it('never matches linked rows, even when the latest handle is self', () => {
    expect(isSelfHandleGroup('p:abc', self)).toBe(false);
  });
  it('ignores other people', () => {
    expect(isSelfHandleGroup('h:lead@example.com', self)).toBe(false);
  });
  it('returns false when there are no self handles', () => {
    expect(isSelfHandleGroup('h:info@example.com', new Set())).toBe(false);
  });
});
