import { format, formatDistanceToNow, parseISO, startOfYear } from 'date-fns';

/**
 * Format currency as GBP
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '£0.00';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number {
  if (!current || !previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
export function formatTimeAgo(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const date = parseISO(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Get date range boundaries from range string
 */
export function getDateRange(range: string): { fromDate: string | null; toDate: string | null } {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  const toDate = format(today, 'yyyy-MM-dd');

  switch (range) {
    case '30d': {
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 30);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
    }
    case '90d': {
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 90);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
    }
    case '1y': {
      const fromDate = startOfYear(today);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
    }
    case 'all': {
      return { fromDate: null, toDate: null };
    }
    default: {
      // Default to 30 days
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 30);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
    }
  }
}

/**
 * Get previous period date range (for percentage change calculations)
 */
export function getPreviousDateRange(range: string): { fromDate: string | null; toDate: string | null } {
  const { fromDate, toDate } = getDateRange(range);
  if (!fromDate || !toDate) return { fromDate: null, toDate: null };

  const to = parseISO(toDate);
  const from = parseISO(fromDate);
  const duration = to.getTime() - from.getTime();

  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo);
  prevFrom.setTime(prevTo.getTime() - duration);
  prevFrom.setHours(0, 0, 0, 0);

  return {
    fromDate: format(prevFrom, 'yyyy-MM-dd'),
    toDate: format(prevTo, 'yyyy-MM-dd'),
  };
}

/**
 * Transform revenue chart data - fill missing months with zeros
 */
export interface ChartDataPoint {
  month: string;
  revenue: number;
}

export function transformRevenueChartData(
  data: Array<{ month: string; paid_amount: number | null }>
): ChartDataPoint[] {
  if (!data || data.length === 0) return [];

  // Sort by month
  const sorted = [...data].sort((a, b) => {
    const dateA = parseISO(a.month);
    const dateB = parseISO(b.month);
    return dateA.getTime() - dateB.getTime();
  });

  // Transform to chart format
  return sorted.map((item) => ({
    month: format(parseISO(item.month), 'MMM yyyy'),
    revenue: item.paid_amount || 0,
  }));
}

