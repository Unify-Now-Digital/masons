import { useOpenOrder } from '@/shared/context/orderPanel';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

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
  const navigate = useNavigate();
  const openOrder = useOpenOrder();
  const [query, setQuery] = useState('');

  const orders = useOrdersList();

  const q = query.trim().toLowerCase();

  const orderResults = useMemo(() => {
    if (!q || !orders.data) return [];
    return orders.data
      .filter((o) =>
        [
          o.order_number != null ? String(o.order_number) : '',
          o.customer_name,
          o.person_name,
          o.sku,
          o.inscription_text,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      )
      .slice(0, MAX_PER_GROUP);
  }, [orders.data, q]);

  const close = () => {
    onOpenChange(false);
    // Reset query on close so reopening starts clean.
    setTimeout(() => setQuery(''), 120);
  };

  const go = (path: string) => {
    navigate(path);
    close();
  };

  const hasAnyResults =
    orderResults.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search orders…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {q && !hasAnyResults && (
          <CommandEmpty>No results for "{query}".</CommandEmpty>
        )}
        {!q && (
          <div className="px-4 py-6 text-center text-sm text-gardens-txs">
            Start typing to search orders by number, customer, SKU or inscription.
          </div>
        )}

        {orderResults.length > 0 && (
          <CommandGroup heading="Orders">
            {orderResults.map((o) => {
              const ref = o.order_number != null ? `OR-${o.order_number}` : 'OR-—';
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
