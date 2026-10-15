import { useCallback, useState } from 'react';
import { readSectionState, writeSectionState, type ContextPanelSection } from '@/shared/lib/contextPanel';

export function useSectionState() {
  const [state, setState] = useState(readSectionState);
  const isOpen = useCallback((id: ContextPanelSection) => state[id] ?? true, [state]);
  const toggle = useCallback((id: ContextPanelSection) => {
    setState((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      writeSectionState(next);
      return next;
    });
  }, []);
  return { isOpen, toggle };
}
