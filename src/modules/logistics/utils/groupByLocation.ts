export const SAME_SITE_RADIUS_MILES = 2;
const EARTH_RADIUS_MILES = 3958.8;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * True if `point` is within `radiusMiles` of any of the `others`.
 * Treats an empty `others` list as "no neighbours" (returns false).
 */
export function isNearAny<T extends GeoPoint>(
  point: GeoPoint,
  others: T[],
  radiusMiles = SAME_SITE_RADIUS_MILES
): boolean {
  return others.some((o) => haversineMiles(point, o) <= radiusMiles);
}

/**
 * Greedy spatial clustering: walk the input, place each point in the first
 * existing cluster whose seed is within `radiusMiles`, else start a new
 * cluster. Order-stable.
 */
export function clusterBySite<T extends GeoPoint>(
  points: T[],
  radiusMiles = SAME_SITE_RADIUS_MILES
): T[][] {
  const clusters: T[][] = [];
  for (const p of points) {
    let placed = false;
    for (const cluster of clusters) {
      if (haversineMiles(cluster[0], p) <= radiusMiles) {
        cluster.push(p);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([p]);
  }
  return clusters;
}
