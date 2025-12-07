export interface Order {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  order_type: string;
  sku: string | null;
  material: string | null;
  color: string | null;
  stone_status: 'NA' | 'Ordered' | 'In Stock';
  permit_status: 'form_sent' | 'customer_completed' | 'pending' | 'approved';
  proof_status: 'NA' | 'Not_Received' | 'Received' | 'In_Progress' | 'Lettered';
  deposit_date: string | null;
  second_payment_date: string | null;
  due_date: string | null;
  installation_date: string | null;
  location: string | null;
  value: number | null;
  progress: number;
  assigned_to: string | null;
  priority: 'low' | 'medium' | 'high';
  timeline_weeks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderInsert = Omit<Order, 'id' | 'created_at' | 'updated_at'>;
export type OrderUpdate = Partial<OrderInsert>;

