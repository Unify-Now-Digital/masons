import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Single view-state model for the unified inbox left panel.
 * Contract: specs/feature/inbox-ia-unification/contracts/view-state-contract.md
 *
 * - `view` ('all' | 'triage' | 'customers') — URL `?view=` is the source of truth;
 *   falls back to the persisted last-used view, then to 'customers' (today's default).
 * - `board` — URL `?board=1` only; never persisted, so a fresh session is always off.
 *
 * Replaces the legacy pair: `?segment=enquiries` (URL) + `inbox.desktop.viewMode.v1`
 * (localStorage-backed React state).
 */

export type InboxViewId = 'all' | 'triage' | 'customers';

const VIEW_STORAGE_KEY = 'inbox.desktop.view.v2';
/** Legacy key: read once for migration, never written again. Left in place so a rollback still finds it. */
const LEGACY_VIEW_MODE_STORAGE_KEY = 'inbox.desktop.viewMode.v1';

const VIEW_IDS = ['all', 'triage', 'customers'] as const;

function isViewId(value: string | null): value is InboxViewId {
  return value !== null && (VIEW_IDS as readonly string[]).includes(value);
}

/**
 * Default when the URL has no valid `?view=`: v2 key, else one-time migration of the
 * legacy viewMode key ('customers' → customers, 'conversations' → all), else 'customers'.
 */
function resolveStoredView(): InboxViewId {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (isViewId(stored)) return stored;
    const legacy = localStorage.getItem(LEGACY_VIEW_MODE_STORAGE_KEY);
    if (legacy === 'customers' || legacy === 'conversations') {
      const migrated: InboxViewId = legacy === 'customers' ? 'customers' : 'all';
      localStorage.setItem(VIEW_STORAGE_KEY, migrated);
      return migrated;
    }
  } catch {
    // ignore storage issues
  }
  return 'customers';
}

/**
 * Pure normalization of legacy URL params (one-shot on mount, wired by the page):
 * - `?segment=enquiries` → `?view=triage` unless a valid `?view=` is already present.
 * - Any other `segment` value is stripped.
 * - An invalid `?view=` value is stripped (default resolution then applies).
 * - Everything else (`conversation`, `channel`, `gmail`, `error`, `board`, …) passes through untouched.
 *
 * Returns the normalized params, or null when nothing needed to change.
 */
export function normalizeLegacyInboxParams(params: URLSearchParams): URLSearchParams | null {
  const rawView = params.get('view');
  const rawSegment = params.get('segment');
  const hasInvalidView = rawView !== null && !isViewId(rawView);
  if (rawSegment === null && !hasInvalidView) return null;

  const next = new URLSearchParams(params);
  if (hasInvalidView) next.delete('view');
  if (rawSegment !== null) {
    next.delete('segment');
    if (rawSegment === 'enquiries' && !isViewId(rawView)) {
      next.set('view', 'triage');
    }
  }
  return next;
}

export function useInboxView() {
  const [searchParams, setSearchParams] = useSearchParams();

  // One-shot read (same idiom as the old viewMode useState initializer) so the
  // migration write happens at most once per mount, not on every render.
  const [storedDefault] = useState<InboxViewId>(resolveStoredView);

  const paramView = searchParams.get('view');
  const view: InboxViewId = isViewId(paramView) ? paramView : storedDefault;
  const board = searchParams.get('board') === '1';

  const setView = useCallback(
    (next: InboxViewId) => {
      const params = new URLSearchParams(searchParams);
      params.set('view', next);
      setSearchParams(params, { replace: true });
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, next);
      } catch {
        // ignore persistence issues
      }
    },
    [searchParams, setSearchParams],
  );

  const setBoard = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams);
      if (next) params.set('board', '1');
      else params.delete('board');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /** Applies normalizeLegacyInboxParams to the current URL. Not invoked anywhere yet (activated in T006). */
  const normalizeLegacyParams = useCallback(() => {
    const next = normalizeLegacyInboxParams(searchParams);
    if (next) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { view, setView, board, setBoard, normalizeLegacyParams };
}
