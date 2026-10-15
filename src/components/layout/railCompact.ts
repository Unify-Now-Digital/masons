import { useEffect, useState } from 'react';

export const RAIL_COMPACT_STORAGE_KEY = 'mason.rail.compact';
const RAIL_COMPACT_BREAKPOINT = 1440;

function readStoredCompact(): boolean | null {
  try {
    const v = localStorage.getItem(RAIL_COMPACT_STORAGE_KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

export function useRailCompact(): [boolean, () => void] {
  const [stored, setStored] = useState<boolean | null>(() => readStoredCompact());
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < RAIL_COMPACT_BREAKPOINT : false,
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < RAIL_COMPACT_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const compact = stored ?? narrow;
  const toggle = () => {
    const next = !compact;
    setStored(next);
    try {
      localStorage.setItem(RAIL_COMPACT_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable: keep in-memory state */
    }
  };
  return [compact, toggle];
}
