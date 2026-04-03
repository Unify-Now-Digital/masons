import { z } from 'zod';

export const matchPaymentSchema = z.object({
  paymentId: z.string().uuid('Payment ID is required'),
  orderId: z.string().uuid('Order ID is required'),
  paymentType: z.enum(['deposit', 'final', 'permit', 'other'], {
    errorMap: () => ({ message: 'Payment type is required' }),
  }),
});

export type MatchPaymentFormData = z.infer<typeof matchPaymentSchema>;

export const extrasActionSchema = z.object({
  extraId: z.string().uuid(),
  action: z.enum(['add_to_invoice', 'dismiss', 'edit_amount']),
  amount: z.number().positive().optional(),
});

export type ExtrasActionFormData = z.infer<typeof extrasActionSchema>;
