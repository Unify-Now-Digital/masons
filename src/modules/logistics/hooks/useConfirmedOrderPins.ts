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
let googleDenied = false;
type LatLng = { lat: number; lng: number };

const POSTCODE = /^\s*([A-Z]{1,2}\d[A-Z\d]?)(\s*\d[A-Z]{2})?\s*(,\s*UK)?\s*$/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Keyless UK postcode / outcode lookup (postcodes.io). */
async function postcodeLookup(q: string): Promise<LatLng | null> {
  const m = POSTCODE.exec(q);
  if (!m) return null;
  const url = m[2]
    ? `https://api.postcodes.io/postcodes/${encodeURIComponent(m[1] + m[2].trim())}`
    : `https://api.postcodes.io/outcodes/${encodeURIComponent(m[1])}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = (await r.json()) as { result?: { latitude?: number; longitude?: number } };
  return j.result?.latitude != null && j.result?.longitude != null ? { lat: j.result.latitude, lng: j.result.longitude } : null;
}

/** OpenStreetMap Nominatim, GB only, max 1 request/second (usage policy). */
async function nominatimLookup(q: string): Promise<LatLng | null> {
  await sleep(1100);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(q)}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { lat: string; lon: string }[];
  return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
}

/**
 * Geocode orders that have no stored coordinates. Google Geocoder first; the production Maps key
 * does NOT have the Geocoding API enabled (REQUEST_DENIED), so on denial we fall back to
 * postcodes.io (postcode/outcode) and OSM Nominatim. Hits are cached in localStorage only.
 */
async function geocodeMissing(pins: OrderPin[]): Promise<Record<string, LatLng | null>> {
  const cache = readGeocodeCache();
  const g = (window as unknown as { google?: typeof google }).google;
  const geocoder = g?.maps?.Geocoder ? new g.maps.Geocoder() : null;
  let changed = false;
  for (const p of pins) {
    if (p.source !== 'geocode' || !p.geocodeQuery) continue;
    const key = geocodeCacheKey(p.geocodeQuery);
    if (cache[key] || failedThisSession.has(key)) continue;
    const queries = [...new Set([p.geocodeQuery, ...(p.geocodeFallbacks ?? [])])];
    let hit: LatLng | null = null;
    if (geocoder && !googleDenied) {
      for (const q of queries) {
        try {
          const { results } = await geocoder.geocode({ address: q, region: 'gb', componentRestrictions: { country: 'GB' } });
          const loc = results?.[0]?.geometry?.location;
          if (loc) { hit = { lat: loc.lat(), lng: loc.lng() }; break; }
        } catch (e) {
          if (String((e as { code?: string })?.code ?? e).includes('REQUEST_DENIED')) { googleDenied = true; break; }
        }
      }
    }
    if (!hit) {
      // Postcode-shaped fallbacks first (cheap, exact), then place names via Nominatim.
      const ordered = [...queries.filter((q) => POSTCODE.test(q)), ...queries.filter((q) => !POSTCODE.test(q))];
      for (const q of ordered) {
        try {
          hit = POSTCODE.test(q) ? await postcodeLookup(q) : await nominatimLookup(q.replace(/,\s*UK$/i, ''));
        } catch {
          hit = null;
        }
        if (hit) break;
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
