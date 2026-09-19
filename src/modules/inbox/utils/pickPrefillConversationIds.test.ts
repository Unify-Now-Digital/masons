import { describe, expect, it } from 'vitest';
import { pickPrefillConversationIds } from './pickPrefillConversationIds';

const row = (id: string, minute: number) => ({
  id,
  created_at: `2026-03-01T10:${String(minute).padStart(2, '0')}:00+00:00`,
});

/** n rows c0..c(n-1), created one minute apart, passed newest first like the list. */
const rows = (n: number) => Array.from({ length: n }, (_, i) => row(`c${i}`, i)).reverse();

describe('pickPrefillConversationIds', () => {
  it('returns every id, oldest first, when there are 10 or fewer', () => {
    expect(pickPrefillConversationIds(rows(3))).toEqual(['c0', 'c1', 'c2']);
    expect(pickPrefillConversationIds(rows(10))).toHaveLength(10);
  });

  it('keeps the oldest 2 and the newest 8 when there are more than 10', () => {
    expect(pickPrefillConversationIds(rows(12))).toEqual([
      'c0', 'c1', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11',
    ]);
  });

  it('breaks created_at ties by id', () => {
    expect(pickPrefillConversationIds([row('b', 5), row('a', 5), row('c', 1)])).toEqual(['c', 'a', 'b']);
  });

  it('returns nothing for no rows and leaves the input unsorted', () => {
    expect(pickPrefillConversationIds([])).toEqual([]);
    const input = rows(3);
    pickPrefillConversationIds(input);
    expect(input.map((r) => r.id)).toEqual(['c2', 'c1', 'c0']);
  });
});
