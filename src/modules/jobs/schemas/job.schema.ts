import { z } from 'zod';

export const jobFormSchema = z.object({
  // Removed: order_id, customer_name
  location_name: z.string().trim().min(1, 'Location name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum(['scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled']).default('scheduled'),
  scheduled_date: z.string().optional().nullable(),
  estimated_duration: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().optional().or(z.literal('')),
  // UI-only fields (not saved to database)
  order_ids: z.array(z.string().uuid()).min(1, 'At least one order is required'),
  assigned_people_ids: z.array(z.string().uuid()).optional(),
});

export type JobFormData = z.infer<typeof jobFormSchema>;

