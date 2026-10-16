import { useCallback, useEffect, useRef } from 'react';

/** Order and person rails live above the router. Local docks live on one page. */
export type PanelKind = 'order' | 'person' | 'local';

type Listener = () => void;

const buckets: Record<PanelKind, Set<Listener>> = {
  order: new Set(),
  person: new Set(),
  local: new Set(),
};

function fire(kind: PanelKind) {
  for (const listener of [...buckets[kind]]) listener();
}

export function subscribePanel(kind: PanelKind, listener: Listener): () => void {
  buckets[kind].add(listener);
  return () => {
    buckets[kind].delete(listener);
  };
}

/**
 * Close every other panel. The panel about to open is left alone, so a local
 * dock does not dismiss itself, and a route change can clear the global rails
 * without wiping a deep-linked orders sidebar.
 */
export function replaceWith(kind: PanelKind) {
  (['order', 'person', 'local'] as const).forEach((other) => {
    if (other !== kind) fire(other);
  });
}

/** Global rails only. Page-local docks unmount with their route. */
export function dismissGlobalPanels() {
  fire('order');
  fire('person');
}

/** Close this page's dock when another panel opens. Call the result before opening it. */
export function useLocalPanel(close: () => void): () => void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => subscribePanel('local', () => closeRef.current()), []);
  return useCallback(() => replaceWith('local'), []);
}
