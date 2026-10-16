import { Clock, FileText, ListOrdered, Mail, MessageCircle, Package, PenLine, CreditCard, User } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ActivityEvent, ActivityIcon } from '@/modules/today/recentActivity';
import { PANEL_PRIMARY } from '@/shared/components/panel/PanelChrome';
import { InfoList } from '@/shared/components/panel/InfoRow';
import { PanelSection } from '@/shared/components/panel/PanelSection';
import { ProductCard } from '@/shared/components/panel/ProductCard';
import { SidePanel } from '@/shared/components/panel/SidePanel';
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
 * In-flow context for Today. Same header as the inbox enquiry panel:
 * type label, serif name, one primary action, and close.
 */
export const DockedContext: React.FC<{
  testId: string;
  kindLabel: string;
  name: string;
  contact?: string;
  contactRows?: { label: string; value: string }[];
  /** Label/value rows for the record card (an enquiry's stone, size, price, …). */
  detailRows?: { label: string; value: string }[];
  /** Primary action under the name. */
  actionLabel?: string;
  onOpenFull?: () => void;
  onClose?: () => void;
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
  testId, kindLabel, name, contact, contactRows = [], detailRows, actionLabel = 'Open order', onOpenFull, onClose, events, recordLabel,
  productName, productHref, specLine, imageUrl, facts, otherOrders, className,
}) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ recent: true, record: true, others: true, contact: true });
  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  return (
    <SidePanel
      mode="dock"
      label={name}
      testId={testId}
      className={className}
      kicker={kindLabel}
      name={name}
      action={onOpenFull ? (
        <button type="button" data-testid="today-open-full" onClick={onOpenFull} className={PANEL_PRIMARY}>
          {actionLabel}
        </button>
      ) : undefined}
      onClose={onClose}
    >
      <PanelSection id="recent" title="Recent activity" icon={Clock} open={open.recent !== false} onToggle={toggle} aside={events.length || undefined}>
        {events.length === 0 ? (
          <p className="m-0 text-[13px] text-gardens-txs">Nothing on file yet.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {events.map((event, index) => {
              const Icon = ICONS[event.icon] ?? FileText;
              return (
                <li key={event.id} className={cn('grid grid-cols-[52px_18px_minmax(0,1fr)] gap-x-2 py-2', index > 0 && 'border-t border-gardens-bdr')}>
                  <span className="whitespace-nowrap pt-px text-[12px] tabular-nums text-gardens-txm-aa">{event.when}</span>
                  <span className="pt-px text-gardens-txm-aa">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 text-[13px] font-semibold">{event.title}</span>
                      {event.href && (
                        <Link to={event.href} className="ml-auto shrink-0 text-[12px] font-semibold text-gardens-acc-dk">Open</Link>
                      )}
                    </span>
                    {event.quote && (
                      <span className="border-l-2 border-gardens-bdr pl-2 font-head text-[13px] italic leading-snug text-gardens-tx">{event.quote}</span>
                    )}
                    {event.detail && <span className="text-[12px] text-gardens-txs">{event.detail}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </PanelSection>

      <PanelSection id="record" title={recordLabel} icon={Package} open={open.record !== false} onToggle={toggle}>
        <div className="flex flex-col gap-3">
          <ProductCard
            name={productName || 'None'}
            spec={specLine}
            imageUrl={imageUrl}
            href={productName ? productHref : null}
          />
          {detailRows && detailRows.length > 0 ? (
            <InfoList rows={detailRows} />
          ) : facts.length > 0 ? (
            <InfoList
              rows={facts.slice(0, 3).map((fact) => ({
                label: fact.label,
                value: fact.value,
                valueClassName: DOCK_TONE[fact.tone ?? 'muted'],
              }))}
            />
          ) : null}
        </div>
      </PanelSection>

      <PanelSection id="contact" title="Contact" icon={User} open={open.contact !== false} onToggle={toggle}>
        {contactRows.length === 0 ? (
          <p className="m-0 text-[13px] text-gardens-txs">{contact || 'No contact on file.'}</p>
        ) : (
          <InfoList rows={contactRows} />
        )}
      </PanelSection>

      <PanelSection id="others" title="Other orders" icon={ListOrdered} open={open.others !== false} onToggle={toggle}>
        <p className="m-0 text-[13px] text-gardens-tx">{otherOrders}</p>
      </PanelSection>
    </SidePanel>
  );
};
