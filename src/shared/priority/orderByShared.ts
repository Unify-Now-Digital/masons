export interface SharedRank { rank: number; why: string; label: string }

/** Stable re-order: rows in the shared ranking first (by shared rank), the rest keep their order after. */
export function orderByShared<T>(rows: T[], personOf: (r: T) => string | null | undefined, ranks: Map<string, SharedRank>): T[] {
  return rows
    .map((r, i) => ({ r, i, k: ranks.get(personOf(r) ?? '')?.rank ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
}
