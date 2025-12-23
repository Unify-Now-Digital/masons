import { z } from 'zod';

export const invoiceFormSchema = z.object({
  // order_id removed: Orders will be created inline, not selected
  customer_name: z.string().min(1, 'Person name is required'),
  amount: z.number().min(0, 'Amount must be non-negative').optional(), // Calculated client-side
  status: z.enum(['draft', 'pending', 'paid', 'overdue', 'cancelled']).default('pending'),
  due_date: z.string().min(1, 'Due date is required'),
  issue_date: z.string().optional(),
  payment_method: z.string().optional().nullable().or(z.literal('')),
  payment_date: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
}).refine(
  (data) => {
    if (data.due_date && data.issue_date) {
      return new Date(data.due_date) >= new Date(data.issue_date);
    }
    return true;
  },
  {
    message: 'Due date must be on or after issue date',
    path: ['due_date'],
  }
);

export type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

