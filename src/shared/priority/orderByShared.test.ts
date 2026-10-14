import { describe, expect, it } from 'vitest';
import { orderByShared } from './orderByShared';
describe('orderByShared', () => {
  it('puts shared-ranked people first in shared order, keeps the rest stable', () => {
    const ranks = new Map([['b', { rank: 1, why: '', label: '' }], ['c', { rank: 2, why: '', label: '' }]]);
    expect(orderByShared(['a', 'c', 'x', 'b'], (s) => s, ranks)).toEqual(['b', 'c', 'a', 'x']);
  });
});
