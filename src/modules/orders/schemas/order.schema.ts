import { z } from 'zod';

export const orderFormSchema = z.object({
  customer_name: z.string().min(1, 'Deceased name is required'),
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
  progress: z.number().min(0).max(100).default(0),
  assigned_to: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  timeline_weeks: z.number().int().min(1).default(12),
  notes: z.string().optional().or(z.literal('')),
  // UI-only fields (not saved to database)
  productId: z.string().optional(),
  dimensions: z.string().optional(),
});

export type OrderFormData = z.infer<typeof orderFormSchema>;

