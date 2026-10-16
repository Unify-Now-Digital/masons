import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';
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

const PIN_SELECT =
  'id, order_number, customer_name, person_name, permit_status, location, latitude, longitude, stage, archived_at, is_test, ' +
  'job:jobs!job_id(stage, exit_reason), cemetery:cemeteries!cemetery_id(name, address, postcode, latitude, longitude)';

async function fetchConfirmedOrderPins(organizationId: string, excludeTest: boolean): Promise<OrderPin[]> {
  const data = await fetchAllPages((from, to) => {
    let q = supabase
      .from('orders')
      .select(PIN_SELECT)
      // Brand isolation: only the active organisation's orders, never CM + SM together.
      .eq('organization_id', organizationId)
      .is('archived_at', null);
    if (excludeTest) q = q.eq('is_test', false);
    return q.order('id').range(from, to);
  });
  return (data as unknown as PinOrderRow[]).filter(isConfirmedOrder).map(toOrderPin);
}

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
    if (key in cache) continue;
    try {
      const { results } = await geocoder.geocode({ address: p.geocodeQuery, region: 'gb' });
      const loc = results?.[0]?.geometry?.location;
      cache[key] = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
      changed = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // REQUEST_DENIED / "Geocoding API has not been used" is a Cloud project
      // setting, not a bad address. Caching null would keep pins off the map
      // after the API is enabled.
      if (/REQUEST_DENIED|not been used|not activated|ApiNotActivated/i.test(message)) {
        continue;
      }
      cache[key] = null;
      changed = true;
    }
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
        return hit ? { ...p, lat: hit.lat, lng: hit.lng } : p;
      }),
    [query.data, cache],
  );

  return { ...query, pins };
}
