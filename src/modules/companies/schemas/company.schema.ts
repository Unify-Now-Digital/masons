import { z } from 'zod';

export const companyFormSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required'),
  address: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  country: z.string().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  team_members: z.array(z.string().trim()).optional().default([]),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type CompanyFormData = z.infer<typeof companyFormSchema>;

