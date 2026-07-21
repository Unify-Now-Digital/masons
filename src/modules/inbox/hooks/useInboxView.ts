import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Single view-state model for the unified inbox left panel.
 * Contract: specs/feature/inbox-ia-unification/contracts/view-state-contract.md
 *
 * - The person-grouped Customers view IS the inbox — always the default.
 * - `?view=flat` (URL only, never persisted, no UI control) is the escape hatch
 *   to the flat conversation list — same demotion pattern `?board=1` used.
 *
 * History: replaces `?view=all|triage|customers` + the `?board=1` kanban axis.
 * The localStorage keys `inbox.desktop.view.v2` / `inbox.desktop.viewMode.v1`
 * are no longer read or written — stale values (e.g. a saved 'conversations')
 * are simply ignored, so every session lands on the grouped default.
 */

export type InboxViewId = 'customers' | 'flat';

/**
 * Pure normalization of legacy URL params (one-shot on mount, wired by the page):
 * - `?segment=…` (any value) is stripped — the old `enquiries` → triage mapping is gone.
 * - `?board=…` is stripped — the enquiry kanban axis no longer exists.
 * - Any `?view=` other than `flat` is stripped (grouped default then applies).
 * - Everything else (`conversation`, `channel`, `gmail`, `error`, …) passes through untouched.
 *
 * Returns the normalized params, or null when nothing needed to change.
 */
export function normalizeLegacyInboxParams(params: URLSearchParams): URLSearchParams | null {
  const rawView = params.get('view');
  const hasInvalidView = rawView !== null && rawView !== 'flat';
  const hasLegacyParams = params.has('segment') || params.has('board');
  if (!hasLegacyParams && !hasInvalidView) return null;

  const next = new URLSearchParams(params);
  if (hasInvalidView) next.delete('view');
  next.delete('segment');
  next.delete('board');
  return next;
}

export function useInboxView() {
  const [searchParams, setSearchParams] = useSearchParams();

  const view: InboxViewId = searchParams.get('view') === 'flat' ? 'flat' : 'customers';

  /** Applies normalizeLegacyInboxParams to the current URL (one-shot, wired by the page). */
  const normalizeLegacyParams = useCallback(() => {
    const next = normalizeLegacyInboxParams(searchParams);
    if (next) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { view, normalizeLegacyParams };
}
