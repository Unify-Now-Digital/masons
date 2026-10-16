/** Deposit date is set and no amount was recorded. Same words as Finance's record-payment case. */
export const DEPOSIT_AMOUNT_MISSING = 'Deposit marked, no amount recorded';

export function paidGapLabel(): string {
  return DEPOSIT_AMOUNT_MISSING;
}
