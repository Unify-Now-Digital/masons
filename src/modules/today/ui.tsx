import React from 'react';
import { cn } from '@/shared/lib/utils';
import type { Colour } from './todayModel';
import { COLOUR_CLASS } from './uiHelpers';

/** Shell-v2 next-action colours (src/shared/nextAction.ts): red act now · amber soon · green done · blue info. */
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

export const ErrorNote: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div role="alert" className="rounded-lg border border-gardens-sem-red/40 bg-gardens-sem-red-lt px-3 py-2 text-[13px] text-gardens-sem-red">
    <b>{title}</b> <span className="break-words">{message}</span>
  </div>
);
