import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import {
  geocodeCacheKey,
  isConfirmedOrder,
  readGeocodeCache,
  toOrderPin,
  writeGeocodeCache,
  type OrderPin,
  type PinOrderRow,
} from '../utils/permitPins';

export const orderPinKeys = {
  all: ['logistics', 'orderPins'] as const,
  org: (organizationId: string, excludeTest: boolean) => ['logistics', 'orderPins', organizationId, { excludeTest }] as const,
};

async function fetchConfirmedOrderPins(organizationId: string, excludeTest: boolean): Promise<OrderPin[]> {
  let q = supabase
    .from('orders')
    .select(
      'id, order_number, customer_name, person_name, permit_status, location, latitude, longitude, stage, archived_at, is_test, ' +
        'job:jobs!job_id(stage, exit_reason), cemetery:cemeteries!cemetery_id(name, address, postcode, latitude, longitude)',
    )
    // Brand isolation: only the active organisation's orders, never CM + SM together.
    .eq('organization_id', organizationId)
    .is('archived_at', null);
  if (excludeTest) q = q.eq('is_test', false);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as PinOrderRow[]).filter(isConfirmedOrder).map(toOrderPin);
}

const failedThisSession = new Set<string>();

/** Google Geocoder, one query at a time, cached in localStorage. Requires the Maps JS API to be loaded. */
async function geocodeMissing(pins: OrderPin[]): Promise<Record<string, { lat: number; lng: number } | null>> {
  const cache = readGeocodeCache();
  const g = (window as unknown as { google?: typeof google }).google;
  if (!g?.maps?.Geocoder) return cache;
  const geocoder = new g.maps.Geocoder();
  let changed = false;
  for (const p of pins) {
    if (p.source !== 'geocode' || !p.geocodeQuery) continue;
    const key = geocodeCacheKey(p.geocodeQuery);
    if (cache[key]) continue;
    if (failedThisSession.has(key)) continue;
    let hit: { lat: number; lng: number } | null = null;
    for (const q of [p.geocodeQuery, ...(p.geocodeFallbacks ?? [])]) {
      try {
        const { results } = await geocoder.geocode({ address: q, region: 'gb', componentRestrictions: { country: 'GB' } });
        const loc = results?.[0]?.geometry?.location;
        if (loc) { hit = { lat: loc.lat(), lng: loc.lng() }; break; }
      } catch {
        /* try the next fallback */
      }
    }
    if (hit) { cache[key] = hit; changed = true; } else failedThisSession.add(key);
  }
  if (changed) writeGeocodeCache(cache);
  return cache;
}

export function useConfirmedOrderPins(mapsReady: boolean) {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  const query = useQuery({
    queryKey: organizationId ? orderPinKeys.org(organizationId, excludeTest) : ['logistics', 'orderPins', 'disabled'],
    queryFn: () => fetchConfirmedOrderPins(organizationId!, excludeTest),
    enabled: !!organizationId,
  });

  const [cache, setCache] = useState(() => readGeocodeCache());
  useEffect(() => {
    if (!mapsReady || !query.data?.length) return;
    let cancelled = false;
    geocodeMissing(query.data).then((c) => {
      if (!cancelled) setCache({ ...c });
    });
    return () => {
      cancelled = true;
    };
  }, [mapsReady, query.data]);

  const pins = useMemo<OrderPin[]>(
    () =>
      (query.data ?? []).map((p) => {
        if (p.source !== 'geocode' || !p.geocodeQuery) return p;
        const hit = cache[geocodeCacheKey(p.geocodeQuery)];
        return hit ? { ...p, lat: hit.lat, lng: hit.lng } : { ...p, missingReason: `Couldn't find "${p.geocodeQuery}"` };
      }),
    [query.data, cache],
  );

  return { ...query, pins };
}
