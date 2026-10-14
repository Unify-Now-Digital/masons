/**
 * Confirmed-order map pins, coloured by permit status.
 *
 * Colours are taken verbatim from the CM ClickUp "CM: Orders" list statuses
 * (list 901207633256) so the Mason map reads like the ClickUp map view:
 *   deposit paid #f8ae00 · form sent #f8ae00 · customer completed #e16b16 ·
 *   pending #1090e0 · approved #4466ff  (install #b660e0, closed #008844).
 * `not_started` is ClickUp's "deposit paid" (same yellow) drawn hollow so it
 * stays distinguishable from "form sent".
 */
export type PermitPinStatus = 'not_started' | 'form_sent' | 'customer_completed' | 'pending' | 'approved' | 'unknown';

export interface PermitPinStyle {
  status: PermitPinStatus;
  label: string;
  colour: string;
  hollow: boolean;
  clickupStatus: string;
}

export const PERMIT_PIN_STYLES: PermitPinStyle[] = [
  { status: 'not_started', label: 'Not started', colour: '#f8ae00', hollow: true, clickupStatus: 'deposit paid' },
  { status: 'form_sent', label: 'Form sent', colour: '#f8ae00', hollow: false, clickupStatus: 'form sent' },
  { status: 'customer_completed', label: 'Customer completed', colour: '#e16b16', hollow: false, clickupStatus: 'customer completed' },
  { status: 'pending', label: 'Pending (with cemetery)', colour: '#1090e0', hollow: false, clickupStatus: 'pending' },
  { status: 'approved', label: 'Approved', colour: '#4466ff', hollow: false, clickupStatus: 'approved' },
  { status: 'unknown', label: 'No permit status', colour: '#87909e', hollow: true, clickupStatus: '—' },
];

const STYLE_BY_STATUS = new Map(PERMIT_PIN_STYLES.map((s) => [s.status, s]));

export function normalisePermitStatus(raw: string | null | undefined): PermitPinStatus {
  const v = (raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STYLE_BY_STATUS.has(v as PermitPinStatus) ? (v as PermitPinStatus) : 'unknown';
}

export function permitPinStyle(raw: string | null | undefined): PermitPinStyle {
  return STYLE_BY_STATUS.get(normalisePermitStatus(raw))!;
}

/** Job stages that count as a confirmed (deposit paid onward) order that is not yet installed. */
export const CONFIRMED_JOB_STAGES = new Set(['confirmed', 'in_production']);
export const CONFIRMED_ORDER_STAGES = new Set(['deposit_paid', 'in_production']);
const CLOSED_ORDER_STAGES = new Set(['installed', 'exited', 'fixed']);

export interface PinOrderRow {
  id: string;
  order_number: number | null;
  customer_name: string | null;
  person_name: string | null;
  permit_status: string | null;
  location: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  stage: string | null;
  archived_at: string | null;
  is_test: boolean | null;
  job: { stage: string | null; exit_reason: string | null } | null;
  cemetery: {
    name: string | null;
    address: string | null;
    postcode: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
  } | null;
}

export function isConfirmedOrder(o: PinOrderRow): boolean {
  if (o.archived_at || o.is_test) return false;
  if (o.job?.exit_reason) return false;
  if (CLOSED_ORDER_STAGES.has(o.stage ?? '') || o.job?.stage === 'fixed') return false;
  // Same set as the Orders 'Confirmed' tab (getOrderGroup → jobs.stage). orders.stage alone
  // (e.g. a paid order with no job, ORD-271) is not counted, so the two pages always agree.
  return CONFIRMED_JOB_STAGES.has(o.job?.stage ?? '');
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export type PinSource = 'order' | 'cemetery' | 'geocode' | 'none';

export interface PinPlacement {
  source: PinSource;
  lat: number | null;
  lng: number | null;
  /** Address string to geocode when source === 'geocode'. */
  geocodeQuery: string | null;
  /** Fallbacks tried in order when the first query finds nothing (typo-fixed, no street, postcode). */
  geocodeFallbacks?: string[];
}

/** Order lat/lng → cemetery lat/lng → geocode of cemetery address/postcode (→ order location text). */
export function placePin(o: PinOrderRow): PinPlacement {
  const oLat = num(o.latitude), oLng = num(o.longitude);
  if (oLat != null && oLng != null) return { source: 'order', lat: oLat, lng: oLng, geocodeQuery: null };
  const c = o.cemetery;
  const cLat = num(c?.latitude), cLng = num(c?.longitude);
  if (cLat != null && cLng != null) return { source: 'cemetery', lat: cLat, lng: cLng, geocodeQuery: null };
  const cemParts = [c?.name, c?.address, c?.postcode].map((s) => (s ?? '').trim()).filter(Boolean);
  if (c && (c.address?.trim() || c.postcode?.trim())) {
    const cq = dedupe(cemParts).join(', ');
    return { source: 'geocode', lat: null, lng: null, geocodeQuery: `${cq}, UK`, geocodeFallbacks: geocodeFallbacks(cq) };
  }
  const loc = cleanLocation(o.location);
  if (loc) {
    const q = /\buk\b|united kingdom/i.test(loc) ? loc : `${loc}, UK`;
    return { source: 'geocode', lat: null, lng: null, geocodeQuery: q, geocodeFallbacks: geocodeFallbacks(loc) };
  }
  return { source: 'none', lat: null, lng: null, geocodeQuery: null };
}

/** Typo fix ("Cemetry"), first part + town without the street, then a UK postcode on its own. */
export function geocodeFallbacks(loc: string): string[] {
  const fixed = loc.replace(/cemet(?:ry|ary|ery)\b/gi, 'Cemetery').replace(/,?\s*(uk|united kingdom)\s*$/i, '');
  const parts = fixed.split(',').map((s) => s.trim()).filter(Boolean);
  const out = [`${fixed}, UK`];
  if (parts.length > 2) out.push(`${parts[0]}, ${parts[parts.length - 1]}, UK`);
  if (parts.length > 1) out.push(`${parts[0]}, UK`);
  // Street + town (e.g. 'Hanworth Road, Hounslow') when the cemetery name itself isn't known to the geocoder.
  if (parts.length > 2) out.push(`${parts[1]}, ${parts[parts.length - 1]}, UK`);
  const pc = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|[A-Z]{1,2}\d{1,2}[A-Z]?)\b/i.exec(fixed);
  if (pc) out.push(`${pc[1]}, UK`);
  return [...new Set(out)];
}

function dedupe(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) if (!out.some((q) => q.toLowerCase().includes(p.toLowerCase()))) out.push(p);
  return out;
}

/** Strip plot references ("plot 38 H2", "· plot SVSL2082") that confuse the geocoder. */
export function cleanLocation(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[·,]?\s*\bplot\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface OrderPin {
  orderId: string;
  ref: string;
  customerName: string;
  cemeteryName: string;
  permitStatus: PermitPinStatus;
  source: PinSource;
  lat: number | null;
  lng: number | null;
  geocodeQuery: string | null;
  geocodeFallbacks?: string[];
  /** Why the pin can't be placed (shown in 'Not on map'). */
  missingReason?: string;
}

export function toOrderPin(o: PinOrderRow): OrderPin {
  const p = placePin(o);
  return {
    orderId: o.id,
    ref: o.order_number != null ? `ORD-${String(o.order_number).padStart(6, '0')}` : `ORD-${o.id.slice(0, 6).toUpperCase()}`,
    customerName: o.person_name?.trim() || o.customer_name?.trim() || 'Unknown',
    cemeteryName: o.cemetery?.name?.trim() || cleanLocation(o.location) || 'Cemetery not set',
    permitStatus: normalisePermitStatus(o.permit_status),
    ...p,
    missingReason: p.source === 'none' ? 'No cemetery or location on the order' : undefined,
  };
}

/* ---------- client-side geocode cache (localStorage; never written to the DB) ---------- */

// v2: failures are NOT cached forever (v1 stored null permanently, so a single denied/failed
// lookup hid that order from the map for good on that browser).
const CACHE_KEY = 'mason.geocodeCache.v2';
type CacheMap = Record<string, { lat: number; lng: number } | null>;

export function readGeocodeCache(storage: Pick<Storage, 'getItem'> | null = safeStorage()): CacheMap {
  try {
    return JSON.parse(storage?.getItem(CACHE_KEY) ?? '{}') as CacheMap;
  } catch {
    return {};
  }
}

export function writeGeocodeCache(map: CacheMap, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode: cache is best-effort */
  }
}

export const geocodeCacheKey = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
