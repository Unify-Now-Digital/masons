import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AiPanelContext } from './aiPanel';
import type { AiPanelContextValue, AiPanelRegistration } from './aiPanel';

/**
 * Owns the AI panel registration for the shell. PageShell mounts it once, so
 * exactly one registration is live at a time — the mounted page's.
 */
export function AiPanelProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<AiPanelRegistration | null>(null);
  // Closed on load, never persisted (FR-011).
  const [open, setOpen] = useState(false);
  const panelRef = useRef<React.ReactNode>(null);

  const register = useCallback((next: AiPanelRegistration) => {
    setRegistration((prev) =>
      prev && prev.id === next.id && prev.title === next.title && prev.count === next.count
        ? prev
        : next,
    );
  }, []);

  const unregister = useCallback((id: string) => {
    // If a newer page has already registered, leave its registration in place;
    // either way the panel closes, because the route it belonged to is gone.
    setRegistration((prev) => (prev && prev.id !== id ? prev : null));
    setOpen(false);
  }, []);

  const value = useMemo<AiPanelContextValue>(
    () => ({ registration, panelRef, open, setOpen, register, unregister }),
    [registration, open, register, unregister],
  );

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>;
}
