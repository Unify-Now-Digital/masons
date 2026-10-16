/** Saved dates vs the working draft. Auto-proposals are not drafts. */

export function countDraftChanges(
  orderIds: readonly string[],
  draft: ReadonlyMap<string, string | null>,
  baseline: ReadonlyMap<string, string | null>,
): number {
  let n = 0;
  for (const id of orderIds) {
    if ((draft.get(id) ?? null) !== (baseline.get(id) ?? null)) n += 1;
  }
  return n;
}

/**
 * Proposed dates that differ from the saved baseline and have not been
 * adopted into the draft. Those stay suggestions.
 */
export function suggestionMap(
  orderIds: readonly string[],
  proposed: ReadonlyMap<string, string | null>,
  baseline: ReadonlyMap<string, string | null>,
  draft: ReadonlyMap<string, string | null>,
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const id of orderIds) {
    const saved = baseline.get(id) ?? null;
    if ((draft.get(id) ?? null) !== saved) continue;
    const proposedDate = proposed.get(id) ?? null;
    if (proposedDate !== saved) out.set(id, proposedDate);
  }
  return out;
}

export function shownPlacement(
  id: string,
  draft: ReadonlyMap<string, string | null>,
  baseline: ReadonlyMap<string, string | null>,
  suggestions: ReadonlyMap<string, string | null>,
): { date: string | null; suggested: boolean } {
  const saved = baseline.get(id) ?? null;
  const edited = draft.get(id) ?? null;
  if (edited !== saved) return { date: edited, suggested: false };
  if (suggestions.has(id)) return { date: suggestions.get(id) ?? null, suggested: true };
  return { date: saved, suggested: false };
}
