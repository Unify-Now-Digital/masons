import { z } from 'zod';

export const memorialFormSchema = z.object({
  // Visible fields (simplified UI)
  name: z.string().trim().min(1, 'Name is required'),
  price: z.number().min(0, 'Price must be 0 or greater'),
  photoUrl: z.string().url('Photo URL must be a valid URL').optional().nullable().or(z.literal('')),
  // Hidden fields with safe defaults (required by DB schema but not shown in UI)
  orderId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional().nullable(),
  deceasedName: z.string().trim().optional().default(''),
  dateOfBirth: z.string().optional().nullable(),
  dateOfDeath: z.string().optional().nullable(),
  cemeteryName: z.string().trim().optional().default(''),
  cemeterySection: z.string().trim().optional().or(z.literal('')),
  cemeteryPlot: z.string().trim().optional().or(z.literal('')),
  memorialType: z.string().trim().optional().default(''),
  material: z.string().trim().optional().or(z.literal('')),
  color: z.string().trim().optional().or(z.literal('')),
  dimensions: z.string().trim().optional().or(z.literal('')),
  inscriptionText: z.string().trim().optional().or(z.literal('')),
  inscriptionLanguage: z.string().trim().optional().or(z.literal('')),
  installationDate: z.string().optional().nullable(),
  status: z.enum(['planned', 'in_progress', 'installed', 'removed']).default('planned'),
  condition: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type MemorialFormData = z.infer<typeof memorialFormSchema>;

