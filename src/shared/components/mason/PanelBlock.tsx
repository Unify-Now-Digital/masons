import React, { useCallback, useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { readSectionState, writeSectionState, type ContextPanelSection } from '@/shared/lib/contextPanel';

/** Remembered open/closed state for context-panel sections (localStorage, shared by every surface). */
export function useSectionState() {
  const [state, setState] = useState(readSectionState);
  const isOpen = useCallback((id: ContextPanelSection) => state[id] ?? true, [state]);
  const toggle = useCallback((id: ContextPanelSection) => {
    setState((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      writeSectionState(next);
      return next;
    });
  }, []);
  return { isOpen, toggle };
}

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

/**
 * One context-panel section: icon + UPPERCASE label + divider, collapsible.
 * The same header everywhere so sections are easy to identify.
 */
export const PanelBlock: React.FC<PanelBlockProps> = ({ id, title, icon: Icon, open, onToggle, aside, children }) => {
  const bodyId = `ctx-${id}`;
  return (
    <section className="border-t border-gardens-bdr first:border-t-0" data-section={id}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onToggle(id)}
          className="group flex w-full items-center gap-2 px-4 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txs hover:bg-gardens-bdr/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-grn/30"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">{title}</span>
          {aside != null && <span className="normal-case tracking-normal font-semibold text-[11px] text-gardens-txm-aa">{aside}</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="px-4 pb-4 pt-0.5">
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
