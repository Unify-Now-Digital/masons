import React from 'react';

export type PaymentProgressBarTone = { track?: string; fill?: string };

/**
 * Shared payment progress bar (finance hub attention rows; invoices table in C2).
 * Percent must be pre-clamped to 0–100 by the caller — the bar does not re-clamp,
 * matching the hub's original inline markup byte-for-byte.
 */
export const PaymentProgressBar: React.FC<{
  percent: number;
  tone?: PaymentProgressBarTone;
}> = ({ percent, tone }) => (
  <div
    className="h-1.5 w-full rounded-full overflow-hidden"
    style={{ background: tone?.track ?? 'var(--g-red-dk)' }}
  >
    <div
      className="h-full rounded-full"
      style={{ width: `${percent}%`, background: tone?.fill ?? 'var(--g-grn-dk)' }}
    />
  </div>
);
