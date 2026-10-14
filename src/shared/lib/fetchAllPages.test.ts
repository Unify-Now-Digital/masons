import { describe, expect, it } from 'vitest';
import { fetchAllPages } from './fetchAllPages';

describe('fetchAllPages', () => {
  it('pages past the cap until a short page', async () => {
    const all = Array.from({ length: 2503 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAllPages((from, to) => {
      calls.push([from, to]);
      return Promise.resolve({ data: all.slice(from, to + 1), error: null });
    });
    expect(rows).toHaveLength(2503);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('throws on error', async () => {
    await expect(fetchAllPages(() => Promise.resolve({ data: null, error: new Error('x') }))).rejects.toThrow('x');
  });
});
