/**
 * Tomorrow and Not needed. Client-side only: a map of item key → ISO instant
 * the row stays hidden until. A server-side snooze is a follow-up.
 */
import { useCallback, useEffect, useState } from 'react';

type HideMap = Record<string, string>;

const snoozeKey = (org: string) => `mason-today-snooze:${org}`;
const dismissKey = (org: string) => `mason-today-dismiss:${org}`;

function readMap(key: string | null): HideMap {
  if (!key) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: HideMap = {};
    for (const [id, until] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof until === 'string' && until) out[id] = until;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(key: string, map: HideMap): void {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* private mode */ }
}

/** Local midnight after `now`. Hidden rows come back on that calendar day. */
export function untilTomorrow(now: Date): string {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}

export function isHiddenUntil(until: string | undefined, now: Date): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && now.getTime() < t;
}

export function readSnooze(org: string | null): HideMap {
  return readMap(org ? snoozeKey(org) : null);
}

export function readDismiss(org: string | null): HideMap {
  return readMap(org ? dismissKey(org) : null);
}

export function useTodayHidden(org: string | null, now: Date): {
  hidden: (key: string) => boolean;
  snooze: (key: string) => void;
  dismiss: (key: string) => void;
} {
  const stamp = now.getTime();
  const [maps, setMaps] = useState(() => ({ snooze: readSnooze(org), dismiss: readDismiss(org) }));
  useEffect(() => {
    setMaps({ snooze: readSnooze(org), dismiss: readDismiss(org) });
  }, [org, stamp]);

  const hidden = useCallback((key: string) => {
    return isHiddenUntil(maps.snooze[key] ?? maps.dismiss[key], new Date(stamp));
  }, [maps, stamp]);

  const snooze = useCallback((key: string) => {
    if (!org) return;
    const until = untilTomorrow(new Date(stamp));
    setMaps((prev) => {
      const next = { ...prev.snooze, [key]: until };
      writeMap(snoozeKey(org), next);
      return { ...prev, snooze: next };
    });
  }, [org, stamp]);

  const dismiss = useCallback((key: string) => {
    if (!org) return;
    const until = untilTomorrow(new Date(stamp));
    setMaps((prev) => {
      const next = { ...prev.dismiss, [key]: until };
      writeMap(dismissKey(org), next);
      return { ...prev, dismiss: next };
    });
  }, [org, stamp]);

  return { hidden, snooze, dismiss };
}
