import { z } from 'zod';

export const cemeteryFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  primary_email: z
    .string()
    .trim()
    .email('Invalid email')
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  region: z.string().trim().optional().or(z.literal('')),
  postcode: z.string().trim().optional().or(z.literal('')),
  council: z.string().trim().optional().or(z.literal('')),
  avg_approval_days: z
    .union([z.coerce.number().int().nonnegative(), z.literal('')])
    .optional(),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type CemeteryFormData = z.infer<typeof cemeteryFormSchema>;
