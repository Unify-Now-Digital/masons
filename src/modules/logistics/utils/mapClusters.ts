/** Spread stacked map points, then group whatever still overlaps on screen. */

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
}

const METRES_PER_DEG_LAT = 111_320;

/** Cap for the initial fit. Street-level zoom hides the rest of the round. */
export const MAP_FIT_MAX_ZOOM = 15;

export function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLat = (b.lat - a.lat) * METRES_PER_DEG_LAT;
  const dLng = (b.lng - a.lng) * METRES_PER_DEG_LAT * Math.cos(midLat);
  return Math.hypot(dLat, dLng);
}

/**
 * Fan points that sit on top of each other (same cemetery geocode) onto a ring
 * sized so neighbours are about `tapPx` apart at `zoom`.
 */
export function offsetOverlapping<T extends MapPoint>(
  points: readonly T[],
  zoom = MAP_FIT_MAX_ZOOM,
  tapPx = 44,
): T[] {
  const thresholdM = 30;
  const used = new Set<number>();
  const out = points.map((p) => ({ ...p }));
  for (let i = 0; i < points.length; i += 1) {
    if (used.has(i)) continue;
    const cluster = [i];
    used.add(i);
    for (let j = i + 1; j < points.length; j += 1) {
      if (used.has(j)) continue;
      if (distanceMetres(points[i], points[j]) <= thresholdM) {
        cluster.push(j);
        used.add(j);
      }
    }
    if (cluster.length < 2) continue;
    const lat0 = cluster.reduce((sum, k) => sum + points[k].lat, 0) / cluster.length;
    const lng0 = cluster.reduce((sum, k) => sum + points[k].lng, 0) / cluster.length;
    const chord = tapPx * metresPerPixel(lat0, zoom);
    const radius = chord / (2 * Math.sin(Math.PI / cluster.length));
    const metresPerDegLng = METRES_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
    cluster.forEach((k, idx) => {
      const angle = (2 * Math.PI * idx) / cluster.length - Math.PI / 2;
      out[k] = {
        ...out[k],
        lat: lat0 + (radius * Math.sin(angle)) / METRES_PER_DEG_LAT,
        lng: lng0 + (radius * Math.cos(angle)) / (metresPerDegLng || METRES_PER_DEG_LAT),
      };
    });
  }
  return out;
}

export interface ScreenCluster<T> {
  lat: number;
  lng: number;
  items: T[];
}

/** Group points closer than `thresholdPx` at the current zoom into one tappable cluster. */
export function clusterByScreen<T extends { lat: number; lng: number }>(
  points: readonly T[],
  zoom: number,
  thresholdPx = 36,
): ScreenCluster<T>[] {
  if (points.length === 0) return [];
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const thresholdM = thresholdPx * metresPerPixel(lat, zoom);
  const clusters: ScreenCluster<T>[] = [];
  for (const point of points) {
    const hit = clusters.find((c) => distanceMetres(c, point) <= thresholdM);
    if (!hit) {
      clusters.push({ lat: point.lat, lng: point.lng, items: [point] });
      continue;
    }
    hit.items.push(point);
    hit.lat = hit.items.reduce((sum, item) => sum + item.lat, 0) / hit.items.length;
    hit.lng = hit.items.reduce((sum, item) => sum + item.lng, 0) / hit.items.length;
  }
  return clusters;
}
