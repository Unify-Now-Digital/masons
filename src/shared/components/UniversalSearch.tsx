import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Package, FileText } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { useProofPayload } from '@/modules/proofReview/hooks/useProofReview';

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
  const [query, setQuery] = useState('');

  const customers = useCustomersList();
  const orders = useOrdersList();
  const proofs = useProofPayload();

  const q = query.trim().toLowerCase();

  const peopleResults = useMemo(() => {
    if (!q || !customers.data) return [];
    return customers.data
      .filter((c) =>
        [c.first_name, c.last_name, c.email, c.phone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      )
      .slice(0, MAX_PER_GROUP);
  }, [customers.data, q]);

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

  const proofResults = useMemo(() => {
    const queue = proofs.data?.queue;
    if (!q || !queue) return [];
    return queue
      .filter((p) =>
        [
          p.customerName,
          p.orderNumber != null ? String(p.orderNumber) : '',
          p.inscriptionText,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      )
      .slice(0, MAX_PER_GROUP);
  }, [proofs.data, q]);

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
    peopleResults.length + orderResults.length + proofResults.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search people, orders, inscriptions…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {q && !hasAnyResults && (
          <CommandEmpty>No results for "{query}".</CommandEmpty>
        )}
        {!q && (
          <div className="px-4 py-6 text-center text-sm text-gardens-txs">
            Start typing to search people, orders and inscriptions.
          </div>
        )}

        {peopleResults.length > 0 && (
          <CommandGroup heading="People">
            {peopleResults.map((c) => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
                || c.email
                || c.phone
                || 'Unnamed';
              const sub = [c.email, c.phone].filter(Boolean).join(' · ');
              return (
                <CommandItem
                  key={`person-${c.id}`}
                  value={`person ${c.id} ${name} ${c.email ?? ''} ${c.phone ?? ''}`}
                  onSelect={() => go(`/dashboard/customers?customer=${c.id}`)}
                >
                  <User className="h-4 w-4 mr-2 shrink-0 text-gardens-txs" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{name}</span>
                    {sub && (
                      <span className="text-xs text-gardens-txs truncate">{sub}</span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
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
                  onSelect={() => go(`/dashboard/orders?order=${o.id}`)}
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

        {proofResults.length > 0 && (
          <CommandGroup heading="Inscriptions">
            {proofResults.map((p) => {
              const ref = p.orderNumber != null ? `OR-${p.orderNumber}` : 'OR-—';
              const stateLabel = p.state?.replace(/_/g, ' ') ?? '';
              return (
                <CommandItem
                  key={`proof-${p.id}`}
                  value={`inscription ${p.id} ${p.customerName} ${ref} ${p.inscriptionText ?? ''}`}
                  onSelect={() => go(`/dashboard/proof-review?proof=${p.id}`)}
                >
                  <FileText className="h-4 w-4 mr-2 shrink-0 text-gardens-txs" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{p.customerName || 'Unknown'}</span>
                    <span className="text-xs text-gardens-txs truncate">
                      <span className="font-mono mr-2">{ref}</span>
                      {stateLabel}
                    </span>
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
