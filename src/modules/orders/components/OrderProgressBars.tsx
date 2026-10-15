import React from 'react';
import { computeTimelineProgress, weekCounterText } from '../utils/timelineProgress';
import { paidGapLabel } from '../utils/paidGapLabel';
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

  return (
    <div className="flex flex-col gap-1.5 text-[13px] tabular-nums" data-testid="order-progress">
      <span className="flex items-center gap-2 min-w-0">
        <span className="w-9 shrink-0 text-gardens-txs">Week</span>
        <span className="h-1.5 min-w-[2rem] flex-1 rounded-full bg-[#E9E4D9] overflow-hidden">
          <span
            className="block h-full rounded-full"
            style={{ width: `${weekPct}%`, background: stoneOver ? '#C08A2E' : 'var(--g-na-green)' }}
          />
        </span>
        <span className={`shrink-0 text-right leading-tight ${week.over ? 'font-semibold text-gardens-na-red' : 'text-gardens-tx'}`}>
          {week.text}
        </span>
      </span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="w-9 shrink-0 text-gardens-txs">Paid</span>
        <span
          className="h-1.5 min-w-[2rem] flex-1 rounded-full overflow-hidden"
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
          className={`shrink-0 text-right leading-tight ${amountMissing ? 'font-semibold text-gardens-na-amber' : 'text-gardens-tx'}`}
          title={amountMissing ? 'Deposit received, amount not recorded' : paidFull ? 'Paid in full' : undefined}
        >
          {amountMissing
            ? paidGapLabel()
            : paid == null
              ? '—'
              : paidFull
                ? `${gbp0(total)} ✓`
                : `${gbp0(paid)} / ${gbp0(total)}`}
        </span>
      </span>
    </div>
  );
};
