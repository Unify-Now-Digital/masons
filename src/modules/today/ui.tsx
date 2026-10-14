import React from 'react';
import { cn } from '@/shared/lib/utils';
import { ACTION_COLOUR_CLASS } from '@/shared/nextAction';
import type { Colour } from './todayModel';

/** Shell-v2 next-action colours (src/shared/nextAction.ts): red act now · amber soon · green done · blue info. */
export const COLOUR_CLASS: Record<Colour, string> = {
  red: `${ACTION_COLOUR_CLASS.red.tint} border-transparent`,
  amber: `${ACTION_COLOUR_CLASS.amber.tint} border-transparent`,
  green: `${ACTION_COLOUR_CLASS.green.tint} border-transparent`,
  blue: `${ACTION_COLOUR_CLASS.blue.tint} border-transparent`,
};

export const VerbPill: React.FC<{ colour: Colour; children: React.ReactNode; className?: string; onClick?: () => void }> = ({ colour, children, className, onClick }) => {
  const cls = cn('inline-flex shrink-0 items-center justify-center rounded-full border px-2.5 h-7 text-[12px] font-bold whitespace-nowrap', COLOUR_CLASS[colour], className);
  return onClick ? (
    <button type="button" onClick={onClick} data-colour={colour} className={cn(cls, 'hover:brightness-95')}>{children}</button>
  ) : (
    <span data-colour={colour} className={cls}>{children}</span>
  );
};

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <section className={cn('rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3', className)}>{children}</section>
);

export const H3: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h3 className={cn('m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa', className)}>{children}</h3>
);

export const gbp0 = (n: number | null | undefined) => (n == null ? '—' : `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`);
export const gbp2 = (n: number | null | undefined) => (n == null ? '—' : `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const ErrorNote: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div role="alert" className="rounded-lg border border-gardens-sem-red/40 bg-gardens-sem-red-lt px-3 py-2 text-[13px] text-gardens-sem-red">
    <b>{title}</b> <span className="break-words">{message}</span>
  </div>
);
