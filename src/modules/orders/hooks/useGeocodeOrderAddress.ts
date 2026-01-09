import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { ordersKeys } from './useOrders';
import { mapOrdersKeys } from '@/modules/map/hooks/useOrders';

interface GeocodeOrderAddressVariables {
  orderId: string;
  location: string;
}

interface GeocodeOrderAddressResult {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  error?: string;
}

/**
 * React Query mutation hook to invoke the geocode-order-address Edge Function.
 * - Uses Supabase functions.invoke with the caller's auth context.
 * - Never throws into React Query error channel for expected failures; instead
 *   returns { ok: false, error } so UI can handle gracefully without crashing.
 * - Invalidates relevant order and map queries on settle so updated coords /
 *   geocode metadata are reflected.
 */
export function useGeocodeOrderAddress() {
  const queryClient = useQueryClient();

  return useMutation<GeocodeOrderAddressResult, Error | null, GeocodeOrderAddressVariables>({
    mutationFn: async ({ orderId, location }: GeocodeOrderAddressVariables) => {
      try {
        // TEMP DEBUG: log request payload
        console.debug('[useGeocodeOrderAddress] Invoking edge function', {
          orderId,
          location: location.trim?.() ?? location,
        });

        const { data, error } = await supabase.functions.invoke('geocode-order-address', {
          body: { orderId, location },
        });

        // TEMP DEBUG: log raw response
        console.debug('[useGeocodeOrderAddress] Edge function response', {
          orderId,
          location: location.trim?.() ?? location,
          data,
          error,
        });

        if (error) {
          console.error('[useGeocodeOrderAddress] Edge function error:', error);
          return {
            ok: false,
            error: error.message ?? 'Failed to geocode address',
          };
        }

        // Edge function always returns a JSON object with ok/latitude/longitude/placeId?/error?
        return (data as GeocodeOrderAddressResult) ?? { ok: false, error: 'Unknown geocoding response' };
      } catch (e) {
        console.error('[useGeocodeOrderAddress] Unexpected error:', e);
        const message = e instanceof Error ? e.message : 'Unknown error';
        return { ok: false, error: `Internal error: ${message}` };
      }
    },
    onSettled: (_data, _error, variables) => {
      // After any geocode attempt (success or failure), refresh order + map data
      if (!variables?.orderId) return;

      // Invalidate specific order detail
      queryClient.invalidateQueries({ queryKey: ordersKeys.detail(variables.orderId) });

      // Invalidate all orders-related queries (lists, byInvoice, etc.)
      // Using a prefix key ensures all ['orders', ...] queries are refreshed.
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Invalidate map orders (pins rely on latitude/longitude)
      queryClient.invalidateQueries({ queryKey: mapOrdersKeys.all });
    },
  });
}


