import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InboxFilterPillProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

/** Single filter pill for list filter bar. Selected = dark green; unselected = light grey. */
export const InboxFilterPill: React.FC<InboxFilterPillProps> = ({
  label,
  selected,
  onClick,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-2 py-1 text-[11px] font-medium rounded-full transition-colors',
      selected
        ? 'bg-gardens-sidebar text-white'
        : 'bg-gardens-page text-gardens-txs border border-gardens-bdr hover:bg-gardens-bdr/40',
      className
    )}
  >
    {label}
  </button>
);

/** Row of filter pills; generic over the filter union so both inbox lists can share it. */
export function InboxFilterPillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
      {options.map(({ value: optionValue, label }) => (
        <InboxFilterPill
          key={optionValue}
          label={label}
          selected={value === optionValue}
          onClick={() => onChange(optionValue)}
        />
      ))}
    </div>
  );
}
