/**
 * Confirmed-order map pins, coloured by permit status.
 *
 * Colours = the --g-status-* tokens (src/styles/tokens.css, locked #51 palette), never ClickUp:
 *   not_started  amber  (hollow: on us to send the form)
 *   form_sent    slate  (waiting on the customer)
 *   customer_completed red (on us to submit)
 *   pending      slate-dk (with the cemetery; filled, darker than form sent)
 *   approved     green · unknown grey #857F75 (hollow).
 * `token` is the source of truth; `colour` is its hex fallback for SVG data-URL pins (CSS vars
 * don't resolve there) and is checked against tokens.css by permitPins.test.ts.
 * `clickupStatus` is kept for reference only — it never drives colour.
 */
import { tidyStoredName } from '@/shared/lib/personName';

export type PermitPinStatus = 'not_started' | 'form_sent' | 'customer_completed' | 'pending' | 'approved' | 'unknown';

/** Glyph drawn with the status colour. Colour and hollow/filled meaning stay as they are. */
export type PermitPinShape = 'ring' | 'dot' | 'square' | 'diamond' | 'check' | 'dash';

export interface PermitPinStyle {
  status: PermitPinStatus;
  label: string;
  /** CSS custom property in tokens.css. */
  token: string;
  colour: string;
  hollow: boolean;
  /** Extra shape so a status is not told apart by colour alone. */
  shape: PermitPinShape;
  clickupStatus: string;
}

export const PERMIT_PIN_STYLES: PermitPinStyle[] = [
  { status: 'not_started', label: 'Not started', token: '--g-status-amber', colour: '#9A5410', hollow: true, shape: 'ring', clickupStatus: 'deposit paid' },
  { status: 'form_sent', label: 'Form sent', token: '--g-status-blue', colour: '#5B6573', hollow: false, shape: 'dot', clickupStatus: 'form sent' },
  { status: 'customer_completed', label: 'Customer completed', token: '--g-status-red', colour: '#A3361E', hollow: false, shape: 'square', clickupStatus: 'customer completed' },
  { status: 'pending', label: 'Pending (with cemetery)', token: '--g-status-blue-dk', colour: '#3F4752', hollow: false, shape: 'diamond', clickupStatus: 'pending' },
  { status: 'approved', label: 'Approved', token: '--g-status-green', colour: '#1E7B47', hollow: false, shape: 'check', clickupStatus: 'approved' },
  { status: 'unknown', label: 'No permit status', token: '--g-status-grey', colour: '#857F75', hollow: true, shape: 'dash', clickupStatus: '—' },
];

const STYLE_BY_STATUS = new Map(PERMIT_PIN_STYLES.map((s) => [s.status, s]));

export function normalisePermitStatus(raw: string | null | undefined): PermitPinStatus {
  const v = (raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STYLE_BY_STATUS.has(v as PermitPinStatus) ? (v as PermitPinStatus) : 'unknown';
}

/** Live token value when running in a browser (follows tokens.css / themes), else the hex fallback. */
export function pinColour(s: Pick<PermitPinStyle, 'token' | 'colour'>): string {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return s.colour;
  const v = getComputedStyle(document.documentElement).getPropertyValue(s.token).trim();
  return v || s.colour;
}

export function permitPinStyle(raw: string | null | undefined): PermitPinStyle {
  return STYLE_BY_STATUS.get(normalisePermitStatus(raw))!;
}

/**
 * Inner glyph for the 28×36 permit pin, centred near (14, 13).
 * The pin body keeps `colour`; this only swaps the white centre mark.
 */
export function permitPinInnerSvg(style: Pick<PermitPinStyle, 'shape'>, colour: string): string {
  switch (style.shape) {
    case 'ring':
      return `<circle cx="14" cy="13" r="5.5" fill="white"/>`;
    case 'dash':
      return `<circle cx="14" cy="13" r="5.5" fill="white"/><rect x="11" y="12.2" width="6" height="1.6" rx="0.8" fill="${colour}"/>`;
    case 'square':
      return `<rect x="10.2" y="9.2" width="7.6" height="7.6" rx="1.2" fill="white"/>`;
    case 'diamond':
      return `<polygon points="14,8.2 18.6,13 14,17.8 9.4,13" fill="white"/>`;
    case 'check':
      return `<path d="M10.2 13.2 12.5 15.5 17.8 10" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'dot':
    default:
      return `<circle cx="14" cy="13" r="3.2" fill="white"/>`;
  }
}

/** Order ids whose permit status is currently filtered off. Drives both pin and stop hiding. */
export function hiddenOrderIds(
  pins: Pick<OrderPin, 'orderId' | 'permitStatus'>[],
  hidden: ReadonlySet<PermitPinStatus>,
): Set<string> {
  const ids = new Set<string>();
  if (hidden.size === 0) return ids;
  for (const pin of pins) {
    if (hidden.has(pin.permitStatus)) ids.add(pin.orderId);
  }
  return ids;
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
  return CONFIRMED_JOB_STAGES.has(o.job?.stage ?? '') || CONFIRMED_ORDER_STAGES.has(o.stage ?? '');
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
    return { source: 'geocode', lat: null, lng: null, geocodeQuery: `${dedupe(cemParts).join(', ')}, UK` };
  }
  const loc = cleanLocation(o.location);
  if (loc) return { source: 'geocode', lat: null, lng: null, geocodeQuery: /\buk\b|united kingdom/i.test(loc) ? loc : `${loc}, UK` };
  return { source: 'none', lat: null, lng: null, geocodeQuery: null };
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
}

export function toOrderPin(o: PinOrderRow): OrderPin {
  const p = placePin(o);
  return {
    orderId: o.id,
    ref: o.order_number != null ? `ORD-${String(o.order_number).padStart(6, '0')}` : `ORD-${o.id.slice(0, 6).toUpperCase()}`,
    customerName: tidyStoredName(o.person_name) || tidyStoredName(o.customer_name) || 'Unknown',
    cemeteryName: o.cemetery?.name?.trim() || cleanLocation(o.location) || 'Cemetery not set',
    permitStatus: normalisePermitStatus(o.permit_status),
    ...p,
  };
}

/* ---------- client-side geocode cache (localStorage; never written to the DB) ---------- */

const CACHE_KEY = 'mason.geocodeCache.v1';
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
