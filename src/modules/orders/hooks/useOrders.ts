import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchOrders, 
  fetchOrder, 
  fetchOrdersByInvoice, 
  fetchOrdersByPersonId,
  fetchOrdersByPersonIds,
  fetchOrderPeople,
  upsertOrderPeople,
  createOrder,
  createOrderFromQuote,
  updateOrder,
  deleteOrder, 
  fetchOrderPersonId, 
  fetchInvoicePersonIds,
  fetchAdditionalOptionsByOrder,
  createAdditionalOption,
  updateAdditionalOption,
  deleteAdditionalOption,
} from '../api/orders.api';
import type { OrderInsert, OrderUpdate } from '../types/orders.types';
import { mapOrdersKeys } from '@/modules/map/hooks/useOrders';

export const ordersKeys = {
  all: ['orders'] as const,
  detail: (id: string) => ['orders', id] as const,
  byInvoice: (invoiceId: string) => ['orders', 'byInvoice', invoiceId] as const,
  byPerson: (personId: string) => ['orders', 'byPerson', personId] as const,
  byPersonIds: (personIds: string[]) => ['orders', 'byPersonIds', [...personIds].sort().join(',')] as const,
  personId: (orderId: string) => ['orders', 'personId', orderId] as const,
  personIdsByInvoice: (invoiceId: string) => ['orders', 'personIdsByInvoice', invoiceId] as const,
  additionalOptions: (orderId: string) => ['orders', 'additionalOptions', orderId] as const,
  orderPeople: (orderId: string) => ['orders', 'orderPeople', orderId] as const,
};

export function useOrdersList() {
  return useQuery({
    queryKey: ordersKeys.all,
    queryFn: fetchOrders,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ordersKeys.detail(id),
    queryFn: () => fetchOrder(id),
    enabled: !!id,
  });
}

/**
 * React Query hook to fetch orders by invoice ID
 * @param invoiceId - UUID of the invoice (hook is disabled if invoiceId is falsy)
 * @returns React Query result with orders array
 */
export function useOrdersByInvoice(invoiceId: string | null | undefined) {
  return useQuery({
    queryKey: invoiceId ? ordersKeys.byInvoice(invoiceId) : ['orders', 'byInvoice', 'disabled'],
    queryFn: () => fetchOrdersByInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
}

/**
 * React Query hook to fetch order_people for an order
 * @param orderId - UUID of the order (hook is disabled if orderId is falsy)
 */
export function useOrderPeople(orderId: string | null | undefined) {
  return useQuery({
    queryKey: orderId ? ordersKeys.orderPeople(orderId) : ['orders', 'orderPeople', 'disabled'],
    queryFn: () => fetchOrderPeople(orderId!),
    enabled: !!orderId,
  });
}

/**
 * React Query hook to save order_people for an order
 */
export function useSaveOrderPeople(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (people: { person_id: string; is_primary: boolean }[]) =>
      upsertOrderPeople(orderId, people),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.orderPeople(orderId) });
      queryClient.invalidateQueries({ queryKey: ordersKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      queryClient.invalidateQueries({ queryKey: ['orders', 'byInvoice'] });
      queryClient.invalidateQueries({ queryKey: mapOrdersKeys.all });
    },
  });
}

/**
 * Mutation to save order_people when orderId is known only at call time (e.g. after create)
 */
export function useSaveOrderPeopleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, people }: { orderId: string; people: { person_id: string; is_primary: boolean }[] }) =>
      upsertOrderPeople(orderId, people),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.orderPeople(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: ordersKeys.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      queryClient.invalidateQueries({ queryKey: ['orders', 'byInvoice'] });
      queryClient.invalidateQueries({ queryKey: mapOrdersKeys.all });
    },
  });
}

/**
 * React Query hook to fetch orders by person ID
 * @param personId - UUID of the customer (person) (hook is disabled if personId is falsy)
 * @returns React Query result with orders array
 */
export function useOrdersByPersonId(personId: string | null | undefined) {
  return useQuery({
    queryKey: personId ? ordersKeys.byPerson(personId) : ['orders', 'byPerson', 'disabled'],
    queryFn: () => fetchOrdersByPersonId(personId!),
    enabled: !!personId,
  });
}

/**
 * Fetch orders for multiple person IDs (one query). Used e.g. by inbox list to show order ID per row.
 */
export function useOrdersByPersonIds(personIds: string[]) {
  const stableIds = useMemo(() => [...new Set(personIds)].filter(Boolean).sort(), [personIds]);
  return useQuery({
    queryKey: stableIds.length > 0 ? ordersKeys.byPersonIds(stableIds) : ['orders', 'byPersonIds', 'disabled'],
    queryFn: () => fetchOrdersByPersonIds(stableIds),
    enabled: stableIds.length > 0,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (order: OrderInsert) => createOrder(order),
    onSuccess: (data) => {
      // Set the created order in the detail cache to ensure order_number is immediately available
      queryClient.setQueryData(ordersKeys.detail(data.id), data);
      // Invalidate orders list queries to refresh the table
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      // If order has invoice_id, invalidate byInvoice query
      if (data.invoice_id) {
        queryClient.invalidateQueries({ 
          queryKey: ordersKeys.byInvoice(data.invoice_id) 
        });
      }
      // Invalidate map orders to keep map consistent
      queryClient.invalidateQueries({ queryKey: mapOrdersKeys.all });
    },
  });
}

/** Creates an order from a quote with correct person vs deceased field mapping (see orderFromQuoteConversion). */
export function useCreateOrderFromQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, fields }: { quoteId: string; fields?: Partial<OrderInsert> }) =>
      createOrderFromQuote(quoteId, fields ?? {}),
    onSuccess: (data) => {
      queryClient.setQueryData(ordersKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      if (data.invoice_id) {
        queryClient.invalidateQueries({ queryKey: ordersKeys.byInvoice(data.invoice_id) });
      }
      queryClient.invalidateQueries({ queryKey: mapOrdersKeys.all });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: OrderUpdate }) => 
      updateOrder(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      queryClient.setQueryData(ordersKeys.detail(data.id), data);
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}

/**
 * React Query hook to fetch only person_id from an order (lightweight query)
 * @param orderId - UUID of the order (hook is disabled if orderId is falsy)
 * @param options - Optional configuration including enabled flag
 * @returns React Query result with person_id string or null
 */
export function useOrderPersonId(
  orderId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orderId ? ordersKeys.personId(orderId) : ['orders', 'personId', 'disabled'],
    queryFn: () => fetchOrderPersonId(orderId!),
    enabled: (options?.enabled ?? true) && !!orderId,
  });
}

/**
 * React Query hook to fetch all person_id values from orders linked to an invoice
 * @param invoiceId - UUID of the invoice (hook is disabled if invoiceId is falsy)
 * @param options - Optional configuration including enabled flag
 * @returns React Query result with array of unique person_id strings
 */
export function useInvoicePersonIds(
  invoiceId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: invoiceId ? ordersKeys.personIdsByInvoice(invoiceId) : ['orders', 'personIdsByInvoice', 'disabled'],
    queryFn: () => fetchInvoicePersonIds(invoiceId!),
    enabled: (options?.enabled ?? true) && !!invoiceId,
  });
}

// ============================================================================
// Additional Options Hooks
// ============================================================================

/**
 * React Query hook to fetch additional options for an order
 * @param orderId - UUID of the order (hook is disabled if orderId is falsy)
 * @returns React Query result with array of OrderAdditionalOption objects
 */
export function useAdditionalOptionsByOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: orderId ? ordersKeys.additionalOptions(orderId) : ['orders', 'additionalOptions', 'disabled'],
    queryFn: () => fetchAdditionalOptionsByOrder(orderId!),
    enabled: !!orderId,
  });
}

/**
 * React Query hook to create an additional option
 * @returns Mutation hook for creating additional options
 */
export function useCreateAdditionalOption() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (option: { order_id: string; name: string; cost: number; description?: string | null }) =>
      createAdditionalOption(option),
    onSuccess: (data) => {
      // Invalidate additional options for this order
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.additionalOptions(data.order_id) 
      });
      // Invalidate order detail (to refresh options array)
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.detail(data.order_id) 
      });
      // Invalidate orders list (to refresh totals from view)
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.all 
      });
      // Invalidate orders by invoice if order has invoice_id
      // Note: We need to fetch the order to get invoice_id, but for now we'll invalidate all byInvoice queries
      // A more efficient approach would be to pass invoice_id in the mutation, but that's a future optimization
      queryClient.invalidateQueries({ 
        queryKey: ['orders', 'byInvoice'] 
      });
    },
  });
}

/**
 * React Query hook to update an additional option
 * @returns Mutation hook for updating additional options
 */
export function useUpdateAdditionalOption() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; cost?: number; description?: string | null } }) =>
      updateAdditionalOption(id, updates),
    onSuccess: async (data) => {
      // Invalidate additional options for this order
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.additionalOptions(data.order_id) 
      });
      // Invalidate order detail (to refresh options array)
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.detail(data.order_id) 
      });
      // Invalidate orders list (to refresh totals from view)
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.all 
      });
      // Invalidate orders by invoice (to refresh invoice totals)
      queryClient.invalidateQueries({ 
        queryKey: ['orders', 'byInvoice'] 
      });
    },
  });
}

/**
 * React Query hook to delete an additional option
 * @returns Mutation hook for deleting additional options
 */
export function useDeleteAdditionalOption() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteAdditionalOption(id),
    onSuccess: async (orderId) => {
      // Invalidate additional options for this order
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.additionalOptions(orderId) 
      });
      // Invalidate order detail (to refresh options array)
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.detail(orderId) 
      });
      // Invalidate orders list (to refresh totals from view)
      queryClient.invalidateQueries({ 
        queryKey: ordersKeys.all 
      });
      // Invalidate orders by invoice (to refresh invoice totals)
      queryClient.invalidateQueries({ 
        queryKey: ['orders', 'byInvoice'] 
      });
    },
  });
}

