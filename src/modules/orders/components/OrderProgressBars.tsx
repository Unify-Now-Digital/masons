import React from 'react';
import { computeTimelineProgress, weekCounterText } from '../utils/timelineProgress';
import { DEPOSIT_AMOUNT_MISSING } from '../utils/paidGapLabel';
import { stageTone, type StageInput } from '../utils/stageTone';

const gbp0 = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export interface ProgressOrder extends StageInput {
  timelineWeeks?: number | null;
  total?: number;
  amountPaid?: number;
}

/**
 * Week + paid bars (IA-10.6). The paid bar is the one place a missing deposit
 * amount is marked, so the gap is visible and can be fixed.
 */
export const OrderProgressBars: React.FC<{ order: ProgressOrder; now?: Date }> = ({ order, now }) => {
  const clock = now ?? new Date();
  const timeline = computeTimelineProgress(
    {
      depositDate: order.depositDate,
      timelineWeeks: order.timelineWeeks,
      installationDate: order.installationDate,
    },
    clock,
  );
  const total = order.total || 0;
  const paid = order.amountPaid;
  const depositFlagged = !!(order.depositDate?.trim() || order.jobPaidAt?.trim());
  const amountMissing = depositFlagged && paid === 0;
  const paidFull = paid != null && total > 0 && paid >= total - 0.5;
  const paidPct = paid != null && total > 0 ? Math.max(0, Math.min(100, (paid / total) * 100)) : 0;
  const stoneOver = stageTone(order, 'stone', clock) === 'overdue';
  const weekPct = timeline.state === 'active' ? Math.max(timeline.percent, timeline.elapsedWeeks > 0 ? 4 : 0) : 0;
  const week = weekCounterText(timeline);

  const paidLabel = amountMissing
    ? 'Marked, no amount'
    : paid == null
      ? '—'
      : paidFull
        ? `${gbp0(total)} ✓`
        : `${gbp0(paid ?? 0)} / ${gbp0(total)}`;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-[11.5px] tabular-nums" data-testid="order-progress">
      <span className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2">
        <span className="text-gardens-txs">Week</span>
        <span className="h-1.5 min-w-0 overflow-hidden rounded-full bg-[#E9E4D9]">
          <span
            className="block h-full rounded-full"
            style={{ width: `${weekPct}%`, background: stoneOver ? '#C08A2E' : 'var(--g-na-green)' }}
          />
        </span>
        <span className={`whitespace-nowrap text-right ${week.over ? 'font-semibold text-gardens-na-red' : 'text-gardens-tx'}`}>
          {week.text}
        </span>
      </span>
      <span className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2">
        <span className="text-gardens-txs">Paid</span>
        <span
          className="h-1.5 min-w-0 overflow-hidden rounded-full"
          style={{
            background: amountMissing
              ? 'repeating-linear-gradient(135deg,#FBF0DD 0 4px,#F1DDB8 4px 8px)'
              : '#E9E4D9',
          }}
        >
          {!amountMissing && (
            <span className="block h-full rounded-full bg-gardens-na-green" style={{ width: `${paidFull ? 100 : paidPct}%` }} />
          )}
        </span>
        <span
          data-testid="order-paid-label"
          title={amountMissing ? DEPOSIT_AMOUNT_MISSING : paidFull ? 'Paid in full' : undefined}
          className={`whitespace-nowrap text-right ${amountMissing ? 'font-semibold text-gardens-na-amber' : 'text-gardens-tx'}`}
        >
          {paidLabel}
        </span>
      </span>
    </div>
  );
};
