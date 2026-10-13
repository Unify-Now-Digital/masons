import React from 'react';
import { CalendarDays, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import type { MoneyCard, TrackStep } from '@/shared/lib/orderPanel';
import { StatusSymbol } from './StatusSymbol';

/** 5-step progress track (✓ ◐ ! ○ ?) with a word under each stage. */
export const ProgressTrack: React.FC<{ steps: TrackStep[]; className?: string }> = ({ steps, className }) => (
  <ol className={cn('grid grid-cols-5 relative', className)} aria-label="Progress">
    <span aria-hidden className="absolute left-[10%] right-[10%] top-[13px] h-px bg-gardens-bdr2" />
    {steps.map((s) => (
      <li key={s.stage} className="relative flex flex-col items-center gap-1 text-center">
        <StatusSymbol state={s.state} stage={s.stage} className="relative z-[1]" />
        <span className={cn('text-[11px] font-semibold', s.state === 'blocked' ? 'text-gardens-sem-red' : 'text-gardens-tx')}>
          {s.stage}
        </span>
        <span className={cn('text-[11px] leading-tight', s.state === 'blocked' ? 'text-gardens-sem-red' : 'text-gardens-txm-aa')}>
          {s.word}
        </span>
      </li>
    ))}
  </ol>
);

const MONEY_TONE: Record<MoneyCard['tone'], string> = {
  green: 'bg-gardens-sem-green-lt border-gardens-bdr',
  amber: 'bg-gardens-sem-amber-lt border-gardens-bdr',
  neutral: 'bg-gardens-page border-gardens-bdr',
};

export const MoneyCardView: React.FC<{ card: MoneyCard; icon: 'paid' | 'due' | 'date' }> = ({ card, icon }) => {
  const Icon = icon === 'paid' ? CheckCircle2 : icon === 'due' ? Clock : CalendarDays;
  return (
    <div className={cn('rounded-lg border p-2.5 min-w-0', MONEY_TONE[card.tone])}>
      <div className="flex items-center justify-between text-[12px] text-gardens-txs">
        {card.label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="font-head text-[18px] font-semibold text-gardens-tx tabular-nums">
        {card.amount != null ? formatGbpDecimal(card.amount) : '—'}
      </div>
      <div className="text-[11px] text-gardens-txm-aa truncate">{card.sub}</div>
    </div>
  );
};

export const PanelSection: React.FC<{ title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  aside,
  children,
}) => (
  <section className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa m-0">{title}</h3>
      {aside && <span className="text-[11px] text-gardens-txm-aa">{aside}</span>}
    </div>
    {children}
  </section>
);

export interface OrderPanelProps {
  orderRef: string;
  orderType?: string | null;
  customer: string;
  /** In memory of (orders.customer_name), when it differs from the customer. */
  forName?: string | null;
  valueLabel: string;
  valueSub?: string | null;
  photoUrl?: string | null;
  location?: string | null;
  headerActions?: React.ReactNode;
  /** Drawer only: the joined next-step box. The Inbox uses its next-step bar instead. */
  nextStep?: React.ReactNode;
  steps: TrackStep[];
  stepsAside?: React.ReactNode;
  deposit: MoneyCard;
  balance: MoneyCard;
  moneyNote?: React.ReactNode;
  facts: { label: string; value: React.ReactNode }[];
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Shared order panel (inbox-v11 side panel / orders-v10 drawer). Presentation only. */
export const OrderPanel: React.FC<OrderPanelProps> = ({
  orderRef,
  orderType,
  customer,
  forName,
  valueLabel,
  valueSub,
  photoUrl,
  location,
  headerActions,
  nextStep,
  steps,
  stepsAside,
  deposit,
  balance,
  moneyNote,
  facts,
  children,
  footer,
}) => (
  <div className="flex flex-col min-h-0 h-full" data-testid="order-panel">
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-gardens-txm-aa truncate">
            {orderRef}
            {orderType ? ` · ${orderType}` : ''}
          </span>
          <span className="flex items-center gap-1 shrink-0">{headerActions}</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-md bg-gardens-page border border-gardens-bdr overflow-hidden shrink-0">
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-head text-[17px] font-semibold text-gardens-tx leading-tight">{customer}</div>
            {forName && <div className="text-[12px] text-gardens-txs">for {forName}</div>}
          </div>
          <div className="text-right shrink-0">
            <div className="font-head text-[17px] font-semibold text-gardens-tx tabular-nums">{valueLabel}</div>
            {valueSub && <div className="text-[11px] text-gardens-txm-aa">{valueSub}</div>}
          </div>
        </div>
        {location && (
          <div className="flex items-center gap-1.5 text-[12px] text-gardens-txs">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{location}</span>
          </div>
        )}
      </header>

      {nextStep}

      <PanelSection title="Progress" aside={stepsAside}>
        <ProgressTrack steps={steps} />
      </PanelSection>

      <PanelSection title="Money">
        <div className="grid grid-cols-2 gap-2">
          <MoneyCardView card={deposit} icon={deposit.tone === 'green' ? 'paid' : 'due'} />
          <MoneyCardView card={balance} icon={balance.tone === 'green' ? 'paid' : 'date'} />
        </div>
        {moneyNote && <div className="text-[12px] text-gardens-txs">{moneyNote}</div>}
      </PanelSection>

      {facts.length > 0 && (
        <PanelSection title="Order">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            {facts.map((f) => (
              <React.Fragment key={f.label}>
                <dt className="text-gardens-txs">{f.label}</dt>
                <dd className="text-right text-gardens-tx m-0 truncate">{f.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </PanelSection>
      )}

      {children}
    </div>
    {footer && <div className="shrink-0 border-t border-gardens-bdr p-3 flex flex-col gap-2">{footer}</div>}
  </div>
);
