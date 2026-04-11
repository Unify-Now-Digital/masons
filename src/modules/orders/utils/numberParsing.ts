/**
 * Utility functions for safe numeric parsing with defaults
 */

import type { Order } from '../types/orders.types';

/**
 * Convert a value to a number, defaulting to 0 if null, undefined, empty string, or NaN.
 * Used for numeric fields that have NOT NULL DEFAULT 0 constraints in the database.
 * 
 * @param value - The value to convert (number | null | undefined | string)
 * @returns A number (0 if value is falsy or NaN)
 */
export function toMoneyNumber(value: number | null | undefined | string): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

/**
 * Convert a value to a number, preserving null (unlike toMoneyNumber which defaults to 0).
 * Used for optional numeric fields that can be null.
 * 
 * @param value - The value to convert (number | null | undefined | string)
 * @returns A number or null
 */
export function toNumberOrNull(value: number | null | undefined | string): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

/**
 * Normalize numeric fields from Supabase (which may return strings) to numbers
 * Supabase returns numeric fields as strings, so this function converts them to numbers
 * for use in calculations and formatting.
 * 
 * @param order - Raw order object from Supabase (may have string numeric fields)
 * @returns Normalized Order object with numeric fields as numbers
 */
export type RawOrder = Order & {
  order_additional_options?: Array<{ cost?: number | string | null }>;
  value?: number | string | null;
  permit_cost?: number | string | null;
  renovation_service_cost?: number | string | null;
  additional_options_total?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  progress?: number | string | null;
  timeline_weeks?: number | string | null;
  order_number?: number | string | null;
  geocode_status?: string | null;
  geocode_error?: string | null;
  geocoded_at?: string | null;
  geocode_place_id?: string | null;
};

export function normalizeOrder(order: RawOrder): Order {
  return {
    ...order,
    value: toNumberOrNull(order.value),
    permit_cost: order.permit_cost !== null && order.permit_cost !== undefined 
      ? (typeof order.permit_cost === 'string' ? parseFloat(order.permit_cost) : order.permit_cost)
      : null,
    renovation_service_cost: toNumberOrNull(order.renovation_service_cost),
    // additional_options_total: treat NaN as 0 so order totals never break
    additional_options_total: (() => {
      if (order.additional_options_total == null) return null;
      const v = typeof order.additional_options_total === 'string' ? parseFloat(order.additional_options_total) : order.additional_options_total;
      return Number.isFinite(v) ? v : 0;
    })(),
    // Normalize other numeric fields that might come as strings
    latitude: toNumberOrNull(order.latitude),
    longitude: toNumberOrNull(order.longitude),
    progress: typeof order.progress === 'string' ? parseFloat(order.progress) : (order.progress ?? 0),
    timeline_weeks: typeof order.timeline_weeks === 'string' ? parseInt(order.timeline_weeks, 10) : (order.timeline_weeks ?? 12),
    // Normalize order_number (preserve null, parse string to number)
    order_number: typeof order.order_number === 'string' 
      ? parseInt(order.order_number, 10) 
      : (order.order_number ?? null),
    // Preserve geocode metadata fields (null-safe)
    geocode_status: order.geocode_status || null,
    geocode_error: order.geocode_error || null,
    geocoded_at: order.geocoded_at || null,
    geocode_place_id: order.geocode_place_id || null,
  } as Order;
}

