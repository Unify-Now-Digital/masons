import { useQuery } from '@tanstack/react-query';
import { fetchMonthlyRevenue, fetchOrderStatusSummary, fetchTopProducts } from '../api/reporting.api';

export const reportingKeys = {
  monthlyRevenue: ['reporting', 'monthly-revenue'] as const,
  orderSummary: ['reporting', 'order-summary'] as const,
  topProducts: ['reporting', 'top-products'] as const,
};

export function useMonthlyRevenue() {
  return useQuery({
    queryKey: reportingKeys.monthlyRevenue,
    queryFn: fetchMonthlyRevenue,
  });
}

export function useOrderStatusSummary() {
  return useQuery({
    queryKey: reportingKeys.orderSummary,
    queryFn: fetchOrderStatusSummary,
  });
}

export function useTopProducts() {
  return useQuery({
    queryKey: reportingKeys.topProducts,
    queryFn: fetchTopProducts,
  });
}

