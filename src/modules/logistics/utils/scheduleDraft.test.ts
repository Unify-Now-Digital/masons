import { describe, expect, it } from 'vitest';
import { countDraftChanges, shownPlacement, suggestionMap } from './scheduleDraft';

describe('schedule draft vs suggestions', () => {
  const ids = ['a', 'b'];
  const baseline = new Map<string, string | null>([
    ['a', null],
    ['b', '2026-10-20'],
  ]);

  it('does not count an auto-proposal as an unsaved edit', () => {
    const draft = new Map(baseline);
    const proposed = new Map<string, string | null>([
      ['a', '2026-10-16'],
      ['b', '2026-10-20'],
    ]);
    const suggestions = suggestionMap(ids, proposed, baseline, draft);
    expect(countDraftChanges(ids, draft, baseline)).toBe(0);
    expect(suggestions.get('a')).toBe('2026-10-16');
    expect(suggestions.has('b')).toBe(false);
    expect(shownPlacement('a', draft, baseline, suggestions)).toEqual({
      date: '2026-10-16',
      suggested: true,
    });
  });

  it('counts a date only after it is written into the draft', () => {
    const draft = new Map<string, string | null>([
      ['a', '2026-10-21'],
      ['b', '2026-10-20'],
    ]);
    const suggestions = suggestionMap(ids, new Map([['a', '2026-10-16']]), baseline, draft);
    expect(countDraftChanges(ids, draft, baseline)).toBe(1);
    expect(suggestions.has('a')).toBe(false);
    expect(shownPlacement('a', draft, baseline, suggestions).suggested).toBe(false);
  });
});
