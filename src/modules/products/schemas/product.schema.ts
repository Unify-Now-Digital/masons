import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  slug: z.string().trim().optional().nullable().or(z.literal('')),
  shortDescription: z.string().trim().optional().nullable().or(z.literal('')),
  description: z.string().trim().optional().nullable().or(z.literal('')),
  basePrice: z.number().min(0, 'Price must be 0 or greater'),
  imageUrl: z.string().url('Image URL must be a valid URL').optional().nullable().or(z.literal('')),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().min(0).optional().nullable(),
});

export type ProductFormData = z.infer<typeof productFormSchema>;

