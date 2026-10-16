import { describe, expect, it } from 'vitest';
import { primedDraftForThread, type PrimedLatest } from './primedDraft';

const NOW = 1_000_000;

function pending(partial: Partial<PrimedLatest> & Pick<PrimedLatest, 'text'>): PrimedLatest {
  return {
    at: NOW,
    conversationId: null,
    scopeKey: null,
    ...partial,
  };
}

describe('primedDraftForThread', () => {
  it('returns the draft stored for this conversation', () => {
    const byId = new Map([['anne-conv', 'Hi Anne']]);
    expect(primedDraftForThread(['david-conv', 'anne-conv'], 'david', byId, null, NOW)).toBe('Hi Anne');
  });

  it('does not put one person\'s fallback draft on another person\'s thread', () => {
    const latest = pending({ text: 'Hi Anne', conversationId: 'anne-conv', scopeKey: 'anne' });
    expect(primedDraftForThread(['david-conv'], 'david', new Map(), latest, NOW)).toBeNull();
  });

  it('uses the fallback once the selected person\'s thread is the one on screen', () => {
    const latest = pending({ text: 'Hi Anne', conversationId: 'anne-conv', scopeKey: 'anne' });
    expect(primedDraftForThread([], 'anne', new Map(), latest, NOW)).toBe('Hi Anne');
    expect(primedDraftForThread(['other-channel'], 'anne', new Map(), latest, NOW)).toBe('Hi Anne');
  });

  it('drops an unscoped fallback that was primed for a different conversation', () => {
    const latest = pending({ text: 'Dear David', conversationId: 'david-conv' });
    expect(primedDraftForThread(['anne-conv'], 'anne', new Map(), latest, NOW)).toBeNull();
    expect(primedDraftForThread(['david-conv'], null, new Map(), latest, NOW)).toBe('Dear David');
  });

  it('ignores a fallback that has expired', () => {
    const latest = pending({ text: 'Hi Anne', scopeKey: 'anne', at: NOW - 20_000 });
    expect(primedDraftForThread([], 'anne', new Map(), latest, NOW)).toBeNull();
  });
});
