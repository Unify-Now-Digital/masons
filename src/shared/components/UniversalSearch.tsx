import { useOpenOrder } from '@/shared/context/orderPanel';
import { useOpenPerson } from '@/shared/context/personPanel';
import React, { useMemo, useState } from 'react';
import { Package, User } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { formatPhoneDisplay } from '@/modules/inbox/utils/contactTitle';
import { orderMatchesQuery, orderRefLabel, personMatchesQuery, personResultName } from '@/shared/search/paletteSearch';

const MAX_PER_GROUP = 6;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Universal search palette (⌘K). Mounted only while open so its
 * TanStack queries don't run on every dashboard page load.
 */
export const UniversalSearch: React.FC<Props> = ({ open, onOpenChange }) => {
  if (!open) return null;
  return <UniversalSearchInner open={open} onOpenChange={onOpenChange} />;
};

const UniversalSearchInner: React.FC<Props> = ({ open, onOpenChange }) => {
  const openOrder = useOpenOrder();
  const openPerson = useOpenPerson();
  const [query, setQuery] = useState('');

  const orders = useOrdersList();
  const people = useCustomersList();

  const q = query.trim().toLowerCase();

  const orderResults = useMemo(() => {
    if (!q || !orders.data) return [];
    return orders.data.filter((o) => orderMatchesQuery(o, q)).slice(0, MAX_PER_GROUP);
  }, [orders.data, q]);

  const peopleResults = useMemo(() => {
    if (!q || !people.data) return [];
    return people.data.filter((person) => personMatchesQuery(person, q)).slice(0, MAX_PER_GROUP);
  }, [people.data, q]);

  const close = () => {
    onOpenChange(false);
    // Reset query on close so reopening starts clean.
    setTimeout(() => setQuery(''), 120);
  };

  const hasAnyResults = orderResults.length > 0 || peopleResults.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search orders and people…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {q && !hasAnyResults && (
          <CommandEmpty>No results for "{query}".</CommandEmpty>
        )}
        {!q && (
          <div className="px-4 py-6 text-center text-sm text-gardens-txs">
            Start typing to search orders by ref, or people by name, email or phone.
          </div>
        )}

        {peopleResults.length > 0 && (
          <CommandGroup heading="People">
            {peopleResults.map((person) => {
              const name = personResultName(person);
              const sub = [person.email, person.phone ? formatPhoneDisplay(person.phone) : null].filter(Boolean).join(' · ');
              return (
                <CommandItem
                  key={`person-${person.id}`}
                  value={`person ${person.id} ${name} ${person.email ?? ''} ${person.phone ?? ''}`}
                  onSelect={() => { openPerson({ personId: person.id, name }); close(); }}
                >
                  <User className="h-4 w-4 mr-2 shrink-0 text-gardens-txs" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{name}</span>
                    {sub && <span className="text-xs text-gardens-txs truncate">{sub}</span>}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {orderResults.length > 0 && (
          <CommandGroup heading="Orders">
            {orderResults.map((o) => {
              const ref = orderRefLabel(o.order_number) || 'ORD-—';
              const who = o.customer_name
                || o.person_name
                || 'No customer';
              const sub = [o.person_name && o.person_name !== o.customer_name ? o.person_name : null, o.sku]
                .filter(Boolean)
                .join(' · ');
              return (
                <CommandItem
                  key={`order-${o.id}`}
                  value={`order ${o.id} ${ref} ${who} ${o.sku ?? ''} ${o.inscription_text ?? ''}`}
                  onSelect={() => { openOrder(o.id); close(); }}
                >
                  <Package className="h-4 w-4 mr-2 shrink-0 text-gardens-txs" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">
                      <span className="font-mono text-xs text-gardens-txm mr-2">{ref}</span>
                      {who}
                    </span>
                    {sub && (
                      <span className="text-xs text-gardens-txs truncate">{sub}</span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

      </CommandList>
    </CommandDialog>
  );
};
