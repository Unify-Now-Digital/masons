import React from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ContextPanelSection } from '@/shared/lib/contextPanel';

export interface PanelBlockProps {
  id: ContextPanelSection;
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: (id: ContextPanelSection) => void;
  /** Right side of the header (count, short status). Never truncated. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** One collapsible section card. Same trigger, radius and focus ring on every page. */
export const PanelBlock: React.FC<PanelBlockProps> = ({ id, title, icon: Icon, open, onToggle, aside, children }) => {
  const bodyId = `ctx-${id}`;
  return (
    <section className="mx-3 mt-3 rounded-lg border border-gardens-bdr bg-white px-3.5 py-3" data-section={id}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onToggle(id)}
          className="group flex w-full min-h-11 items-center gap-2 text-left text-xs font-semibold text-gardens-tx hover:text-gardens-tx focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">{title}</span>
          {aside != null && <span className="text-xs font-semibold text-gardens-txm-aa">{aside}</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="pt-2.5">
        {children}
      </div>
    </section>
  );
};

/** Label / value rows that WRAP (never truncate) — readable at 320px. */
export const FactList: React.FC<{ rows: { label: string; value: React.ReactNode }[] }> = ({ rows }) => (
  <dl className="m-0 grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px] leading-snug">
    {rows.map((r) => (
      <React.Fragment key={r.label}>
        <dt className="text-gardens-txs">{r.label}</dt>
        <dd className="m-0 text-gardens-tx break-words [overflow-wrap:anywhere]">{r.value}</dd>
      </React.Fragment>
    ))}
  </dl>
);
