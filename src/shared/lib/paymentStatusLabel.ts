/** Yes/no payment status for people who must not see amounts. No pound sign. */
export interface PaymentStatusFlags {
  deposit_received: boolean;
  fully_paid: boolean;
  balance_outstanding: boolean;
}

export function paymentStatusLabel(status: PaymentStatusFlags | null | undefined): string {
  if (!status) return '—';
  if (status.fully_paid) return 'Fully paid';
  if (status.balance_outstanding && status.deposit_received) return 'Balance outstanding';
  if (status.deposit_received) return 'Deposit received';
  if (status.balance_outstanding) return 'Deposit not received';
  return 'Deposit not received';
}

export function yesNo(value: boolean | null | undefined): 'Yes' | 'No' {
  return value ? 'Yes' : 'No';
}
