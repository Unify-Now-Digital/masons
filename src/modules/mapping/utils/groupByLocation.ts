import type { Order } from '@/modules/orders/types/orders.types';

export const SAME_SITE_RADIUS_MILES = 2;
const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
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

export type GeoOrder = Order & { latitude: number; longitude: number };

/**
 * Greedy spatial clustering: walk the input, place each order in the first
 * existing cluster whose seed is within `radiusMiles`, else start a new
 * cluster. Order-stable: callers should pre-sort by location/lat for
 * deterministic groupings.
 */
export function clusterBySite(
  orders: GeoOrder[],
  radiusMiles = SAME_SITE_RADIUS_MILES
): GeoOrder[][] {
  const clusters: GeoOrder[][] = [];
  for (const order of orders) {
    let placed = false;
    for (const cluster of clusters) {
      if (haversineMiles(cluster[0], order) <= radiusMiles) {
        cluster.push(order);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([order]);
  }
  return clusters;
}
