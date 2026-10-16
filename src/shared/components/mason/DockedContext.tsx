import { CreditCard, FileText, Mail, MessageCircle, PenLine } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import type { ActivityEvent, ActivityIcon } from '@/modules/today/recentActivity';
import { cn } from '@/shared/lib/utils';
import { DOCK_TONE, type DockFact } from './dockFacts';

const ICONS: Record<ActivityIcon, React.ComponentType<{ className?: string }>> = {
  message: MessageCircle,
  mail: Mail,
  file: FileText,
  card: CreditCard,
  proof: PenLine,
};

/**
 * In-flow context for Today. No backdrop and no close control.
 * Recent activity is the first content section.
 */
export const DockedContext: React.FC<{
  testId: string;
  kindLabel: string;
  name: string;
  contact?: string;
  onOpenFull?: () => void;
  events: ActivityEvent[];
  recordLabel: string;
  productName?: string | null;
  productHref?: string | null;
  specLine?: string | null;
  imageUrl?: string | null;
  facts: DockFact[];
  otherOrders: string;
  className?: string;
}> = ({
  testId, kindLabel, name, contact, onOpenFull, events, recordLabel,
  productName, productHref, specLine, imageUrl, facts, otherOrders, className,
}) => (
  <aside
    data-testid={testId}
    data-variant="docked"
    className={cn('flex h-full min-h-0 flex-col overflow-auto border-l bg-gardens-surf text-gardens-tx', className)}
  >
    <header className="flex shrink-0 flex-col gap-1 border-b border-gardens-bdr px-4 pb-3 pt-3.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[.08em] text-gardens-txm-aa">{kindLabel}</span>
        {onOpenFull && (
          <button type="button" data-testid="today-open-full" onClick={onOpenFull} className="ml-auto text-[12px] font-semibold text-gardens-acc-dk">
            Open full ↗
          </button>
        )}
      </div>
      <h2 className="m-0 truncate font-head text-[18px] font-semibold leading-tight">{name}</h2>
      {contact ? <p className="m-0 truncate text-[12.5px] text-gardens-txs">{contact}</p> : null}
    </header>

    <section data-section="recent" className="flex flex-col gap-0.5 border-b border-gardens-bdr px-4 pb-1 pt-3">
      <h3 className="m-0 text-[11.5px] font-bold uppercase tracking-[.08em] text-gardens-tx">Recent activity</h3>
      {events.length === 0 ? (
        <p className="m-0 py-2 text-[13px] text-gardens-txs">Nothing on file yet.</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {events.map((event, index) => {
            const Icon = ICONS[event.icon] ?? FileText;
            return (
              <li key={event.id} className={cn('grid grid-cols-[52px_18px_minmax(0,1fr)] gap-x-2 py-2', index > 0 && 'border-t border-[#EEEAE1]')}>
                <span className="whitespace-nowrap pt-px text-[12px] tabular-nums text-gardens-txm-aa">{event.when}</span>
                <span className="pt-px text-gardens-txm-aa">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 text-[13px] font-semibold">{event.title}</span>
                    {event.href && (
                      <Link to={event.href} className="ml-auto shrink-0 text-[12px] font-semibold text-gardens-acc-dk">Open ↗</Link>
                    )}
                  </span>
                  {event.quote && (
                    <span className="border-l-2 border-gardens-bdr2 pl-2 font-head text-[13px] italic leading-snug text-gardens-tx">{event.quote}</span>
                  )}
                  {event.detail && <span className="text-[12px] text-gardens-txs">{event.detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>

    <section data-section="record" className="flex flex-col gap-2 border-b border-gardens-bdr px-4 py-3">
      <h3 className="m-0 text-[11.5px] font-bold uppercase tracking-[.08em] text-gardens-tx">{recordLabel}</h3>
      <div className="flex items-center gap-2.5">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md border border-gardens-bdr object-cover" />
        ) : (
          <span className="h-10 w-10 shrink-0 rounded-md border border-gardens-bdr bg-[#E9E4D9]" aria-hidden />
        )}
        <span className="flex min-w-0 flex-col">
          {productName ? (
            productHref ? (
              <Link to={productHref} className="truncate text-[13px] font-semibold text-gardens-acc-dk">{productName}</Link>
            ) : (
              <span className="truncate text-[13px] font-semibold">{productName}</span>
            )
          ) : (
            <span className="text-[13px] text-gardens-txs">None</span>
          )}
          {specLine ? <span className="truncate text-[12px] text-gardens-txs">{specLine}</span> : null}
        </span>
      </div>
      {facts.length > 0 && (
        <dl className="m-0 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-[12.5px] tabular-nums">
          {facts.slice(0, 3).map((fact) => (
            <React.Fragment key={fact.label}>
              <dt className="text-gardens-txm-aa">{fact.label}</dt>
              <dd className={cn('m-0 truncate', DOCK_TONE[fact.tone ?? 'muted'])}>{fact.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </section>

    <section data-section="others" className="flex flex-col gap-1 px-4 py-3">
      <h3 className="m-0 text-[11.5px] font-bold uppercase tracking-[.08em] text-gardens-tx">Other orders</h3>
      <p className="m-0 text-[13px] text-gardens-tx">{otherOrders}</p>
    </section>
  </aside>
);
