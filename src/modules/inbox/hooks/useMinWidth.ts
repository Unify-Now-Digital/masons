import { useCallback, useSyncExternalStore } from 'react';

const minWidthQuery = (px: number) => `(min-width: ${px}px)`;

/** Current match, read synchronously (no first-render flash, unlike `useIsMobile`). */
export function readMinWidth(px: number): boolean {
  return window.matchMedia(minWidthQuery(px)).matches;
}

/** Subscribes to the media query's change event; returns the unsubscribe. */
export function subscribeMinWidth(px: number, onChange: () => void): () => void {
  const mql = window.matchMedia(minWidthQuery(px));
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** True while the viewport is at least `px` wide. Client-only (no server snapshot). */
export function useMinWidth(px: number): boolean {
  const subscribe = useCallback((onChange: () => void) => subscribeMinWidth(px, onChange), [px]);
  const getSnapshot = useCallback(() => readMinWidth(px), [px]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
