import { z } from 'zod';

/**
 * Canonical font style options for inscription engravings.
 * Defined ONCE here — import via @/modules/orders everywhere else.
 */
export const INSCRIPTION_FONT_OPTIONS = [
  'Times New Roman',
  'Arial',
  'Palatino',
  'Garamond',
  'Script',
  'Block',
  'Old English',
  'Other',
] as const;

export type InscriptionFont = typeof INSCRIPTION_FONT_OPTIONS[number];

export const additionalOptionSchema = z.object({
  id: z.string().optional(), // For tracking existing options in EditOrderDrawer
  name: z.string().min(1, 'Name is required'),
  cost: z.number().min(0, 'Cost must be positive').optional().nullable(),
  description: z.string().optional().nullable(),
});

export const orderPeopleSchema = z.object({
  person_id: z.string().uuid(),
  is_primary: z.boolean(),
});

export const orderFormSchema = z.object({
    order_people: z
      .array(orderPeopleSchema)
      .default([])
      .refine((arr) => arr.length === 0 || arr.filter((p) => p.is_primary).length === 1, 'Exactly one person must be primary'),
  customer_name: z.string(),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
  customer_phone: z.string().optional().or(z.literal('')),
  order_type: z.enum(['New Memorial', 'Renovation'], {
    required_error: 'Order type is required',
  }),
  sku: z.string().min(1, 'Grave number is required'),
  material: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
  stone_status: z.enum(['NA', 'Ordered', 'In Stock']).default('NA'),
  permit_status: z.enum(['form_sent', 'customer_completed', 'pending', 'approved']).default('pending'),
  proof_status: z.enum(['NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered']).default('Not_Received'),
  deposit_date: z.string().optional().nullable(),
  second_payment_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  installation_date: z.string().optional().nullable(),
  location: z.string().min(1, 'Location is required'),
  latitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional()
    .nullable(),
  longitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional()
    .nullable(),
  value: z.number().min(0, 'Value must be positive').optional().nullable(),
  permit_cost: z.number().min(0, 'Permit cost must be positive').optional().nullable(),
  permit_form_id: z.string().uuid().optional().nullable(),
  renovation_service_description: z.string().optional().nullable(), // Only used for Renovation order types
  renovation_service_cost: z.number().min(0, 'Service cost must be positive').optional().nullable(), // Only used for Renovation order types
  additional_options_total: z.number().min(0).optional().nullable(), // Read-only, derived from view
  progress: z.number().min(0).max(100).default(0),
  assigned_to: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  timeline_weeks: z.number().int().min(1).default(12),
  notes: z.string().optional().or(z.literal('')),
  // Inscription fields
  inscription_text: z.string().nullish(),
  inscription_font: z.string().nullish(),
  inscription_font_other: z.string().nullish(),
  inscription_layout: z.string().nullish(),
  inscription_additional: z.string().nullish(),
  /** Saved to orders.product_id when set */
  product_id: z
    .preprocess((val) => (val === '' || val === undefined ? null : val), z.string().uuid().nullable())
    .optional(),
  dimensions: z.string().optional(),
  productPhotoUrl: z.string().url('Product photo URL must be a valid URL').optional().nullable().or(z.literal('')), // Snapshot of product photo URL, populated automatically from product selection
  additional_options: z.array(additionalOptionSchema).optional().default([]),
  // Legacy: kept for backward compat in payloads; derived from order_people primary
  person_id: z.string().uuid().optional().nullable(),
});

export type OrderFormData = z.infer<typeof orderFormSchema>;

