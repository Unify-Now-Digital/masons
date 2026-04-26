export interface OrderPerson {
  id: string;
  order_id: string;
  person_id: string;
  is_primary: boolean;
  created_at: string;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export interface OrderAdditionalOption {
  id: string;
  order_id: string;
  name: string;
  description: string | null;
  cost: number; // NOT NULL DEFAULT 0
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  /** Tenant scope; set on insert for multi-org isolation. */
  organization_id?: string | null;
  order_number: number | null;
  invoice_id: string | null;
  /** Set when the order was created from a quote. */
  quote_id?: string | null;
  job_id: string | null;
  permit_form_id: string | null;
  person_id: string | null;
  person_name: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  order_type: string;
  /** Optional FK to `products.id` (catalog selection). Grave/plot is `sku`. */
  product_id?: string | null;
  /** Fallback quote product label when `product_id` is not linked yet. */
  quote_product_name?: string | null;
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
  latitude: number | null;
  longitude: number | null;
  value: number | null;
  permit_cost: number | null;
  product_photo_url: string | null; // Snapshot of product photo URL at order creation/update time
  renovation_service_description?: string | null; // Only used for Renovation order types
  renovation_service_cost?: number | null; // Only used for Renovation order types
  additional_options_total?: number | null; // From orders_with_options_total view (optional for backward compatibility)
  additional_options?: OrderAdditionalOption[]; // Optional, populated via join for detail views
  geocode_status: 'idle' | 'ok' | 'failed' | null; // Status of last geocoding attempt
  geocode_error: string | null; // Error message if geocoding failed
  geocoded_at: string | null; // Timestamp of last successful geocoding
  geocode_place_id: string | null; // Optional place ID from geocoding provider
  progress: number;
  assigned_to: string | null;
  priority: 'low' | 'medium' | 'high';
  timeline_weeks: number;
  notes: string | null;
  // Inscription fields for engraving
  inscription_text?: string | null;
  inscription_font?: string | null;
  inscription_font_other?: string | null;
  inscription_layout?: string | null;
  inscription_additional?: string | null;
  created_at: string;
  updated_at: string;
  /** True when this row is part of seeded demo data. */
  is_test?: boolean | null;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  people?: OrderPerson[];
  primary_person_id?: string | null;
}

export type OrderInsert = Omit<Order, 'id' | 'created_at' | 'updated_at'>;
export type OrderUpdate = Partial<OrderInsert>;

