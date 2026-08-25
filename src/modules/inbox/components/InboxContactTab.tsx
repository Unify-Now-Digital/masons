import React from 'react';
import { User } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { Customer } from '@/modules/customers/hooks/useCustomers';
import { formatDateDMY } from '@/shared/lib/formatters';

export interface InboxContactTabProps {
  /** True when the selection resolves to a person (effectivePersonId != null). */
  hasLinkedPerson: boolean;
  /** The panel's existing useCustomer result; undefined while loading or when unlinked. */
  person: Customer | undefined;
}

const EM_DASH = '—';

/** Contact tab body for the inbox right panel. Presentational only — no data hooks. */
export const InboxContactTab: React.FC<InboxContactTabProps> = ({ hasLinkedPerson, person }) => {
  if (!hasLinkedPerson) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <User className="h-5 w-5 text-gardens-txs" />
        <p className="text-sm text-gardens-txs">No linked contact for this conversation</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-10 w-full rounded-lg bg-gardens-bdr/80" />
        <Skeleton className="h-10 w-full rounded-lg bg-gardens-bdr/80" />
        <Skeleton className="h-10 w-full rounded-lg bg-gardens-bdr/80" />
      </div>
    );
  }

  const name =
    [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || EM_DASH;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Name', value: name },
    {
      label: 'Email',
      value: person.email ? (
        <a href={`mailto:${person.email}`} className="hover:underline">
          {person.email}
        </a>
      ) : (
        EM_DASH
      ),
    },
    {
      label: 'Phone',
      value: person.phone ? (
        <a href={`tel:${person.phone}`} className="hover:underline">
          {person.phone}
        </a>
      ) : (
        EM_DASH
      ),
    },
    { label: 'Address', value: person.address || EM_DASH },
    { label: 'City', value: person.city || EM_DASH },
    { label: 'Country', value: person.country || EM_DASH },
    { label: 'Status', value: person.is_customer ? 'Customer' : 'Contact' },
    { label: 'Customer since', value: formatDateDMY(person.created_at) },
  ];

  return (
    <div className="rounded-xl border border-gardens-bdr bg-white/90 p-3.5 space-y-1.5 shadow-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[11px] text-gardens-txs">{label}</span>
          <span className="min-w-0 truncate text-right text-[11px] font-medium text-gardens-tx">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
};
