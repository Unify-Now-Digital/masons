import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InboxFilterPillProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

/** Single filter pill for list filter bar. Selected uses the PipelinePage:100-102 pairing
 *  (acc-lt bg + acc border + acc-dk text), the same idiom as the Finance chips at
 *  InvoiceWorkspace.tsx:650/:671; unselected is the page surface. `border` sits in the base
 *  string so both states carry 1px — selecting a pill causes no size shift. */
export const InboxFilterPill: React.FC<InboxFilterPillProps> = ({
  label,
  selected,
  onClick,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      'shrink-0 whitespace-nowrap px-1.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
      selected
        ? 'bg-gardens-acc-lt border-gardens-acc text-gardens-acc-dk'
        : 'bg-gardens-page border-gardens-bdr text-gardens-tx hover:bg-gardens-bdr/40',
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
    <div className="flex flex-nowrap items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide">
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
