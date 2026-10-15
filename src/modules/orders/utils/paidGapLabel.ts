const gbp0 = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

/** The one place a missing deposit amount is marked (IA-10.6). */
export function paidGapLabel(total: number): string {
  return `£? / ${gbp0(total)}`;
}
