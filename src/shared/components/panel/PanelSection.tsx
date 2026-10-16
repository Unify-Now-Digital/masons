import React from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface PanelSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: (id: string) => void;
  /** Right side of the header (count, short status). Never truncated. */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Collapsible section card shared by every right-hand panel.
 * Icon, title, optional count, chevron. Same radius, border and focus ring.
 */
export const PanelSection: React.FC<PanelSectionProps> = ({ id, title, icon: Icon, open, onToggle, aside, className, children }) => {
  const bodyId = `panel-section-${id}`;
  return (
    <section className={cn('mx-3 mt-3 flex flex-col rounded-lg border border-gardens-bdr bg-white px-3.5 py-3', className)} data-section={id}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onToggle(id)}
          className="group flex min-h-11 w-full items-center gap-2 text-left text-xs font-semibold text-gardens-tx hover:text-gardens-tx focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">{title}</span>
          {aside != null && aside !== '' && <span className="text-xs font-semibold text-gardens-txm-aa">{aside}</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      <div id={bodyId} className={cn('pt-2.5', open ? 'flex min-h-0 flex-1 flex-col' : 'hidden')}>
        {children}
      </div>
    </section>
  );
};
