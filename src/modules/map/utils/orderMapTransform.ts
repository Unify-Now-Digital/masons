import type { Order } from '@/modules/orders/types/orders.types';
import type { MapMarker } from './mapTransform';
import { mapStoneStatusToOperational, type OperationalStatus } from './orderStatusMap';

export interface OrderMapMarker extends MapMarker {
  jobId: string | null;
  isAssigned: boolean;
  value: number | null;
  sku: string | null;
  material: string | null;
  color: string | null;
  operationalStatus: OperationalStatus;
  stone_status: 'NA' | 'Ordered' | 'In Stock';
}

/**
 * Get marker color based on assignment status
 */
export function getOrderMarkerColor(isAssigned: boolean, isSelected: boolean = false): string {
  if (isSelected) return '#8b5cf6'; // purple for selected
  if (isAssigned) return '#9ca3af'; // gray for assigned
  return '#3b82f6'; // blue for unassigned
}

/**
 * Transform Order to map marker format
 */
export function transformOrderToMarker(order: Order): OrderMapMarker | null {
  // Only include orders with valid coordinates
  if (order.latitude === null || order.longitude === null) {
    return null;
  }

  const lat = order.latitude;
  const lng = order.longitude;

  // Defensive guards: ensure finite numbers within valid ranges
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const isAssigned = order.job_id !== null;
  const operationalStatus = mapStoneStatusToOperational(order.stone_status);

  return {
    id: order.id,
    customer: order.customer_name, // Deceased name
    location: order.location || 'No location',
    address: order.location || '', // Use location as address fallback
    coordinates: {
      lat,
      lng,
    },
    status: 'scheduled', // Default status for Orders (not Job status)
    priority: order.priority,
    scheduledDate: null, // Orders don't have scheduled_date
    estimatedDuration: null, // Orders don't have estimated_duration
    jobId: order.job_id,
    isAssigned,
    value: order.value,
    sku: order.sku,
    material: order.material,
    color: order.color,
    operationalStatus,
    stone_status: order.stone_status,
  };
}

/**
 * Transform array of Orders to map markers
 */
export function transformOrdersToMarkers(orders: Order[]): OrderMapMarker[] {
  return orders
    .map(transformOrderToMarker)
    .filter((marker): marker is OrderMapMarker => marker !== null);
}

