import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Btn } from '@/shared/components/gardens';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { formatOrderNumber } from '@/modules/orders/utils/orderDisplayId';
import { useLinkableOrders, useUnmatchedInvoices } from '../hooks/useFinance';
import { linkInvoiceToOrder } from '../api/finance.api';

/** Stripe-created invoices the webhook/import could not match to an order — link by hand. */
export const UnmatchedInvoicesPanel: React.FC = () => {
  const { organizationId } = useOrganization();
  const qc = useQueryClient();
  const unmatched = useUnmatchedInvoices();
  const orders = useLinkableOrders((unmatched.data?.length ?? 0) > 0);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const link = async (invoiceId: string) => {
    const order = orders.data?.find((o) => o.id === choice[invoiceId]);
    if (!order || !organizationId) return;
    setBusy(invoiceId);
    setError(null);
    try {
      await linkInvoiceToOrder(organizationId, invoiceId, order);
      await qc.invalidateQueries({ queryKey: ['finance'] });
      await qc.invalidateQueries({ queryKey: ['invoices'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link invoice');
    } finally {
      setBusy(null);
    }
  };

  const rows = unmatched.data ?? [];
  return (
    <Card padded>
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-semibold text-gardens-tx">Unmatched invoices</div>
        <div className="text-[11px] text-gardens-txm">
          Created in Stripe without an order ref. Tip: add metadata <code>order</code> = ORD-000123 in Stripe and it links itself.
        </div>
        {error && <div className="text-[12px] text-gardens-red-dk">{error}</div>}
        {rows.length === 0 && <div className="text-[12px] text-gardens-txs">Nothing to link.</div>}
        {rows.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="font-semibold">{inv.invoice_number}</span>
            <span>{inv.customer_name}</span>
            <span>{formatGbpDecimal(Number(inv.amount) || 0)}</span>
            <span className="text-gardens-txm">{inv.stripe_link_reason}</span>
            <select
              className="border rounded px-1 py-0.5"
              value={choice[inv.id] ?? ''}
              onChange={(e) => setChoice((c) => ({ ...c, [inv.id]: e.target.value }))}
              aria-label={`Order for ${inv.invoice_number}`}
            >
              <option value="">Choose order…</option>
              {(orders.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number != null ? formatOrderNumber(o.order_number) : o.id.slice(0, 8)} · {o.customer_name ?? '—'}
                </option>
              ))}
            </select>
            <Btn size="sm" variant="secondary" disabled={!choice[inv.id] || busy === inv.id} onClick={() => link(inv.id)}>
              {busy === inv.id ? 'Linking…' : 'Link'}
            </Btn>
          </div>
        ))}
      </div>
    </Card>
  );
};
