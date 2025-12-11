import { z } from 'zod';

export const paymentFormSchema = z.object({
  invoiceId: z.string().uuid('Invoice is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'online', 'other'], {
    errorMap: () => ({ message: 'Payment method is required' }),
  }),
  reference: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type PaymentFormData = z.infer<typeof paymentFormSchema>;

