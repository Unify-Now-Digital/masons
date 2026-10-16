import { describe, expect, it } from 'vitest';
import { paymentStatusLabel, yesNo } from './paymentStatusLabel';

describe('paymentStatusLabel', () => {
  it('names the status without a pound sign', () => {
    expect(paymentStatusLabel({ deposit_received: true, fully_paid: true, balance_outstanding: false })).toBe('Fully paid');
    expect(paymentStatusLabel({ deposit_received: true, fully_paid: false, balance_outstanding: true })).toBe('Balance outstanding');
    expect(paymentStatusLabel({ deposit_received: false, fully_paid: false, balance_outstanding: true })).toBe('Deposit not received');
    expect(paymentStatusLabel(null)).toBe('—');
    expect(paymentStatusLabel({ deposit_received: true, fully_paid: false, balance_outstanding: false })).toBe('Deposit received');
  });

  it('yesNo is only Yes or No', () => {
    expect(yesNo(true)).toBe('Yes');
    expect(yesNo(false)).toBe('No');
    expect(yesNo(null)).toBe('No');
  });
});
