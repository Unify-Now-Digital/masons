import { createContext, useCallback, useContext, useEffect, useId } from 'react';
import type { MutableRefObject, ReactNode } from 'react';

/**
 * Metadata the PageShell host needs to render the floating AI button.
 * Primitives only — see `panelRef` below for why the panel node is not here.
 */
export interface AiPanelRegistration {
  /** Identifies the registering page instance; unregister is a no-op unless it matches. */
  id: string;
  /** Sheet title and button aria-label. */
  title: string;
  /** Bubble count; the host hides the bubble at 0 (FR-013). */
  count: number;
}

export interface AiPanelContextValue {
  /** null on every route that has not registered a panel (FR-012). */
  registration: AiPanelRegistration | null;
  /**
   * The registered panel node, held in a ref rather than in state. The
   * registering page passes a fresh element on every one of its renders;
   * holding that in provider state would set state on every render of a
   * provider that wraps the page — a render loop. The host reads the ref when
   * it renders (open/close, or a registration change), and the panel component
   * owns its own query subscription, so a node captured at open time still
   * shows live data.
   */
  panelRef: MutableRefObject<ReactNode>;
  /** Open state lives here, not in the host, so the registering page can close it. */
  open: boolean;
  setOpen: (open: boolean) => void;
  register: (registration: AiPanelRegistration) => void;
  unregister: (id: string) => void;
}

export const AiPanelContext = createContext<AiPanelContextValue | null>(null);

function useAiPanelContext(hookName: string): AiPanelContextValue {
  const ctx = useContext(AiPanelContext);
  if (!ctx) {
    throw new Error(`${hookName} must be used within AiPanelProvider`);
  }
  return ctx;
}

export interface RegisterAiPanelOptions {
  title: string;
  /** Defaults to 0 — no bubble. */
  count?: number;
  panel: ReactNode;
}

/**
 * Page-side registration (FR-010). Only a mounted page registers, so the button
 * is route-scoped by construction. Returns `close` for the page's own
 * "clicked an item, dismiss the panel" path (FR-015).
 */
export function useRegisterAiPanel({
  title,
  count = 0,
  panel,
}: RegisterAiPanelOptions): { close: () => void } {
  const { panelRef, register, unregister, setOpen } = useAiPanelContext('useRegisterAiPanel');
  const id = useId();

  // After every render of the registering page: keep the node current without
  // touching state.
  useEffect(() => {
    panelRef.current = panel;
  });

  // Keys on primitives only, so it settles in one pass. Deliberately no cleanup:
  // a count change must not unregister, which would close an open panel.
  useEffect(() => {
    register({ id, title, count });
  }, [register, id, title, count]);

  // Unmount only — all three deps are stable.
  useEffect(
    () => () => {
      unregister(id);
      panelRef.current = null;
    },
    [unregister, panelRef, id],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);
  return { close };
}

/** Host-side view of the registration. */
export function useAiPanelRegistration(): {
  registration: AiPanelRegistration | null;
  panel: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const { registration, panelRef, open, setOpen } = useAiPanelContext('useAiPanelRegistration');
  return { registration, panel: panelRef.current, open, setOpen };
}
