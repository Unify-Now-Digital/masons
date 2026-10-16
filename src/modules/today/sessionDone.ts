/**
 * Items finished on Today. Counted in the queue header until local midnight.
 * 11d calls `complete(key, verbPast)` after a prepared action succeeds.
 */
import { useCallback, useEffect, useState } from 'react';

export type DoneMap = Record<string, string>;

const storageKey = (org: string) => `mason-today-done:${org}`;

/** Local calendar day, so the count resets at midnight on this machine. */
export function localDayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function readDone(org: string | null, now: Date): DoneMap {
  if (!org) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(org)) ?? 'null') as { day?: string; items?: DoneMap } | null;
    if (!raw || raw.day !== localDayKey(now) || !raw.items || typeof raw.items !== 'object') return {};
    const items: DoneMap = {};
    for (const [key, verb] of Object.entries(raw.items)) {
      if (typeof verb === 'string' && verb) items[key] = verb;
    }
    return items;
  } catch {
    return {};
  }
}

export function writeDone(org: string, now: Date, items: DoneMap): void {
  try {
    localStorage.setItem(storageKey(org), JSON.stringify({ day: localDayKey(now), items }));
  } catch { /* private mode */ }
}

function sameMap(a: DoneMap, b: DoneMap): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

export function useTodayDone(org: string | null, now: Date): { done: DoneMap; complete: (key: string, verbPast: string) => void } {
  const stamp = now.getTime();
  const day = localDayKey(now);
  const [done, setDone] = useState<DoneMap>(() => readDone(org, now));
  useEffect(() => {
    const next = readDone(org, new Date(stamp));
    setDone((prev) => (sameMap(prev, next) ? prev : next));
  }, [org, day, stamp]);
  const complete = useCallback((key: string, verbPast: string) => {
    if (!org || !verbPast) return;
    const at = new Date(stamp);
    setDone((prev) => {
      const next = { ...prev, [key]: verbPast };
      writeDone(org, at, next);
      return next;
    });
  }, [org, stamp]);
  return { done, complete };
}
