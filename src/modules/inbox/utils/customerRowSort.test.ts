import { describe, expect, it } from 'vitest';
import { sortCustomerRows } from './customerRowSort';

const h = 3600_000;
const ag = (side: 'us' | 'them', sinceMs: number) => ({ bucket: 'customer', aging: { ball: { side, sinceMs } } }) as never;

describe('sortCustomerRows (page-level, drives default selection)', () => {
  it('top row = customer chasing longest; unaged rows last', () => {
    const map = new Map([
      ['a', ag('them', 50 * h)],
      ['b1', ag('them', 1 * h)],
      ['b2', ag('us', 2 * h)],
      ['c', ag('us', 9 * h)],
    ]);
    const rows = [
      { key: 'A', conversationIds: ['a'] },
      { key: 'B', conversationIds: ['b1', 'b2'] },
      { key: 'C', conversationIds: ['c'] },
      { key: 'D', conversationIds: ['none'] },
    ];
    expect(sortCustomerRows(rows, map).map((r) => r.key)).toEqual(['C', 'B', 'A', 'D']);
  });
});
