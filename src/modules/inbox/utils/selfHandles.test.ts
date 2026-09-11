import { describe, expect, it } from 'vitest';
import { buildSelfHandles, isSelfHandleGroup } from './selfHandles';

describe('buildSelfHandles', () => {
  it('includes active gmail + connected channel accounts + whatsapp', () => {
    const set = buildSelfHandles({
      gmailAddress: 'Info@SearsMelvin.co.uk',
      gmailStatus: 'active',
      whatsappFrom: '+447700900123',
      channelAccounts: [
        { account_identifier: 'hello@searsmelvin.co.uk', is_connected: true },
        { account_identifier: 'old@searsmelvin.co.uk', is_connected: false },
      ],
    });
    expect(set.has('info@searsmelvin.co.uk')).toBe(true);
    expect(set.has('hello@searsmelvin.co.uk')).toBe(true);
    expect(set.has('old@searsmelvin.co.uk')).toBe(false);
    expect(set.has('7700900123')).toBe(true); // last 10 digits
  });

  it('skips revoked gmail', () => {
    const set = buildSelfHandles({
      gmailAddress: 'info@searsmelvin.co.uk',
      gmailStatus: 'revoked',
    });
    expect(set.size).toBe(0);
  });
});

describe('isSelfHandleGroup', () => {
  const self = new Set(['info@searsmelvin.co.uk']);
  it('matches unlinked handle keys', () => {
    expect(isSelfHandleGroup('h:info@searsmelvin.co.uk', 'x', self)).toBe(true);
  });
  it('matches linked rows whose latest handle is self', () => {
    expect(isSelfHandleGroup('p:abc', 'Info@searsmelvin.co.uk', self)).toBe(true);
  });
  it('ignores other people', () => {
    expect(isSelfHandleGroup('h:lead@example.com', 'lead@example.com', self)).toBe(false);
  });
});
