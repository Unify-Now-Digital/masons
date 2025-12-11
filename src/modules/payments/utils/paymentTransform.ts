import type { Payment, PaymentInsert, PaymentUpdate } from '../hooks/usePayments';
import type { PaymentFormData } from '../schemas/payment.schema';

// UI-friendly payment format (camelCase)
export interface UIPayment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'bank_transfer' | 'check' | 'online' | 'other';
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Transform database payment to UI-friendly format
 */
export function transformPaymentFromDb(payment: Payment): UIPayment {
  return {
    id: payment.id,
    invoiceId: payment.invoice_id,
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    reference: payment.reference || null,
    notes: payment.notes || null,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  };
}

/**
 * Transform array of database payments to UI format
 */
export function transformPaymentsFromDb(payments: Payment[]): UIPayment[] {
  return payments.map(transformPaymentFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toPaymentInsert(form: PaymentFormData): PaymentInsert {
  return {
    invoice_id: form.invoiceId,
    amount: form.amount,
    date: form.date,
    method: form.method,
    reference: normalizeOptional(form.reference),
    notes: normalizeOptional(form.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toPaymentUpdate(form: PaymentFormData): PaymentUpdate {
  return {
    invoice_id: form.invoiceId,
    amount: form.amount,
    date: form.date,
    method: form.method,
    reference: normalizeOptional(form.reference),
    notes: normalizeOptional(form.notes),
  };
}

