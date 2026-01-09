import { z } from 'zod';

export const inscriptionFormSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID').optional().nullable(),
  inscriptionText: z.string().trim().min(1, 'Inscription text is required'),
  type: z.enum(['front', 'back', 'side', 'plaque', 'additional'], {
    errorMap: () => ({ message: 'Inscription type is required' }),
  }),
  style: z.string().trim().optional().or(z.literal('')),
  color: z.enum(['gold', 'silver', 'white', 'black', 'natural', 'other']).optional().nullable(),
  proofUrl: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid URL format' }
    ),
  status: z.enum(['pending', 'proofing', 'approved', 'engraving', 'completed', 'installed']).default('pending'),
  engravedBy: z.string().trim().optional().or(z.literal('')),
  engravedDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type InscriptionFormData = z.infer<typeof inscriptionFormSchema>;

