export interface MonthlyRevenue {
  month: string;
  invoice_count: number;
  paid_amount: number;
  outstanding_amount: number;
  total_amount: number;
}

export interface OrderStatusSummary {
  total_orders: number;
  ready_for_install: number;
  overdue: number;
  pending_approval: number;
  avg_progress: number;
}

export interface TopProduct {
  product_name: string;
  order_count: number;
  total_revenue: number;
}

