import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  /** Extra classes on the value (tone, emphasis). */
  valueClassName?: string;
}

/**
 * One label/value row: muted label on the left, value on the right.
 * Values wrap; they are not truncated.
 */
export const InfoRow: React.FC<InfoRowProps> = ({ label, value, valueClassName }) => (
  <div className="flex items-start justify-between gap-3">
    <dt className="shrink-0 text-[13px] text-gardens-txs">{label}</dt>
    <dd className={cn('m-0 min-w-0 text-right text-[13px] font-medium text-gardens-tx break-words [overflow-wrap:anywhere]', valueClassName)}>
      {value}
    </dd>
  </div>
);

export const InfoList: React.FC<{ rows: InfoRowProps[]; className?: string }> = ({ rows, className }) => (
  <dl className={cn('m-0 flex flex-col gap-1.5', className)}>
    {rows.map((row) => (
      <InfoRow key={row.label} label={row.label} value={row.value} valueClassName={row.valueClassName} />
    ))}
  </dl>
);
