import { z } from 'zod';

export const memorialFormSchema = z.object({
  orderId: z.string().uuid('Order is required'),
  jobId: z.string().uuid().optional().nullable(),
  deceasedName: z.string().trim().min(1, 'Deceased name is required'),
  dateOfBirth: z.string().optional().nullable(),
  dateOfDeath: z.string().optional().nullable(),
  cemeteryName: z.string().trim().min(1, 'Cemetery name is required'),
  cemeterySection: z.string().trim().optional().or(z.literal('')),
  cemeteryPlot: z.string().trim().optional().or(z.literal('')),
  memorialType: z.string().trim().min(1, 'Memorial type is required'),
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

