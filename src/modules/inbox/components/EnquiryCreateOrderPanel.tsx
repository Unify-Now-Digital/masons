import React, { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import type { InboxConversation } from '@/modules/inbox/types/inbox.types';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { linkConversationToOrder } from '@/modules/inbox/api/inboxConversations.api';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';

export interface EnquiryCreateOrderPanelProps {
  conversation: InboxConversation;
  onOrderCreated?: (orderId: string) => void;
}

interface EnquiryPrefill {
  initialPersonId?: string;
  initialCustomerName?: string;
  initialCustomerEmail?: string;
  initialCustomerPhone?: string;
}

export const EnquiryCreateOrderPanel: React.FC<EnquiryCreateOrderPanelProps> = ({
  conversation,
  onOrderCreated,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const personId = conversation.person_id ?? null;
  const { data: person } = useCustomer(personId ?? '');

  const prefill = useMemo<EnquiryPrefill>(() => {
    if (personId && person) {
      const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
      return {
        initialPersonId: personId,
        initialCustomerName: name || undefined,
        initialCustomerEmail: person.email ?? undefined,
        initialCustomerPhone: person.phone ?? undefined,
      };
    }

    const handle = conversation.primary_handle?.trim() || '';
    if (conversation.channel === 'email') {
      return {
        initialCustomerName: handle || undefined,
        initialCustomerEmail: handle || undefined,
      };
    }
    return {
      initialCustomerName: handle || undefined,
      initialCustomerPhone: handle || undefined,
    };
  }, [personId, person, conversation.primary_handle, conversation.channel]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto p-4">
      <div className="shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gardens-txs mb-1">
          Enquiry
        </p>
        <p className="text-[13px] font-semibold text-gardens-tx mb-0.5 truncate">
          {prefill.initialCustomerName || conversation.primary_handle}
        </p>
        <p className="text-[11px] text-gardens-txm mb-4 truncate">
          {conversation.channel} · {conversation.primary_handle}
        </p>

        <div className="rounded-lg border border-gardens-bdr bg-gardens-surf2 p-3">
          <p className="text-[12px] text-gardens-txs leading-snug mb-3">
            This enquiry isn’t linked to an order yet. Create one to move it out of the funnel —
            the customer details below are prefilled from what we know.
          </p>
          <dl className="text-[11.5px] text-gardens-tx space-y-1 mb-3">
            {prefill.initialCustomerName ? (
              <div className="flex justify-between gap-2">
                <dt className="text-gardens-txm">Name</dt>
                <dd className="truncate">{prefill.initialCustomerName}</dd>
              </div>
            ) : null}
            {prefill.initialCustomerEmail ? (
              <div className="flex justify-between gap-2">
                <dt className="text-gardens-txm">Email</dt>
                <dd className="truncate">{prefill.initialCustomerEmail}</dd>
              </div>
            ) : null}
            {prefill.initialCustomerPhone ? (
              <div className="flex justify-between gap-2">
                <dt className="text-gardens-txm">Phone</dt>
                <dd className="truncate">{prefill.initialCustomerPhone}</dd>
              </div>
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-white bg-gardens-grn-dk hover:bg-gardens-grn rounded-md px-3 py-2"
          >
            <Package className="h-3.5 w-3.5" aria-hidden />
            Create order from enquiry
          </button>
        </div>
      </div>

      <CreateOrderDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialPersonId={prefill.initialPersonId ?? null}
        initialCustomerName={prefill.initialCustomerName}
        initialCustomerEmail={prefill.initialCustomerEmail}
        initialCustomerPhone={prefill.initialCustomerPhone}
        onOrderCreated={async (orderId) => {
          await linkConversationToOrder(conversation.id, orderId);
          onOrderCreated?.(orderId);
        }}
      />
    </div>
  );
};