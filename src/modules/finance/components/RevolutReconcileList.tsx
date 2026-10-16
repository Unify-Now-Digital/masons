import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { OrderPaymentRow, OrderRow } from '@/modules/today/brandData.types';
import { gbp2 } from '@/modules/today/uiHelpers';
import { formatLondonDate } from '../londonTime';
import { orderName, orderRef } from '../receivables';
import {
  isOpenRevolutItem,
  paidSoFar,
  revolutAcceptable,
  revolutDecisionMessage,
  type RevolutDecisionKind,
} from '../acceptRevolut';
import { acceptRevolutPayment, ignoreRevolutPayment } from '../acceptRevolutWrite';

const PREVIEW = 3;
const field = 'mt-1 w-full rounded-md border border-gardens-bdr bg-gardens-surf px-2 py-1.5 text-[13px] text-gardens-tx';
const btn = 'inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-gardens-bdr bg-gardens-surf px-2 text-[12px] font-medium text-gardens-tx disabled:opacity-50 lg:h-8';

function confidenceLabel(value: string | undefined): string {
  if (value === 'high' || value === 'exact') return 'High';
  if (value === 'medium' || value === 'name') return 'Medium';
  return 'Low';
}

export const RevolutReconcileList: React.FC<{ payments: OrderPaymentRow[]; orders: OrderRow[] }> = ({ payments, orders }) => {
  const { organizationId } = useOrganization();
  const qc = useQueryClient();
  const queue = payments.filter(isOpenRevolutItem);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['brand-data'] });
    qc.invalidateQueries({ queryKey: ['order-payments'] });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const accept = useMutation({
    mutationFn: async (input: { row: OrderPaymentRow; orderId: string }) => {
      if (!organizationId) throw new Error('No organisation selected');
      return acceptRevolutPayment({
        organizationId,
        row: input.row,
        orderId: input.orderId,
        paid: paidSoFar(input.orderId, payments),
      });
    },
    onSuccess: (kind) => {
      setNote(revolutDecisionMessage(kind, 'accept'));
      setPicking(null);
      invalidate();
    },
  });

  const ignore = useMutation({
    mutationFn: async (row: OrderPaymentRow) => {
      if (!organizationId) throw new Error('No organisation selected');
      return ignoreRevolutPayment({ organizationId, row });
    },
    onSuccess: (kind: RevolutDecisionKind) => {
      setNote(revolutDecisionMessage(kind, 'ignore'));
      invalidate();
    },
  });

  const ordersById = new Map(orders.map((order) => [order.id, order]));

  return (
    <div data-testid="revolut-reconcile">
      <p className="m-0 px-1 text-[12px] text-gardens-txs">
        Revolut payments waiting to be matched. Accept writes the existing row onto the order. It does not create a second payment.
      </p>
      {note && <p role="status" className="m-0 mt-2 px-1 text-[12px] text-gardens-txs">{note}</p>}
      {(accept.isError || ignore.isError) && (
        <p role="alert" className="m-0 mt-2 px-1 text-[12px] text-gardens-na-red">
          {((accept.error ?? ignore.error) as Error).message}
        </p>
      )}
      {queue.length === 0 ? (
        <p className="m-0 mt-2 px-1 text-[13px] text-gardens-txs">No Revolut payments waiting.</p>
      ) : (
        <ul className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0" data-testid="revolut-reconcile-rows">
          {(showAll ? queue : queue.slice(0, PREVIEW)).map((row) => {
            const suggestion = row.match_candidates?.[0] ?? null;
            const suggestedOrder = suggestion ? ordersById.get(suggestion.order_id) : undefined;
            const chosen = picked[row.id] || suggestion?.order_id || '';
            const acceptable = revolutAcceptable(row);
            const pending = (row.provider_state ?? '').toLowerCase() === 'pending';
            const busy = accept.isPending || ignore.isPending;
            return (
              <li key={row.id} className="px-1 py-1" data-testid="revolut-reconcile-row">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] lg:flex-nowrap">
                  <span className="shrink-0 text-gardens-txs">{formatLondonDate(row.received_at)}</span>
                  <span className="min-w-0 truncate font-semibold text-gardens-tx">{row.counterparty_name || 'Unknown payer'}</span>
                  <span className="min-w-0 truncate text-gardens-txs">{row.reference || 'No reference'}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-gardens-txs">
                    {suggestion ? (
                      <>
                        Suggested {suggestedOrder ? `${orderRef(suggestedOrder)} · ${orderName(suggestedOrder)}` : suggestion.order_ref}
                        {' · '}{confidenceLabel(suggestion.confidence)} confidence
                        {suggestion.reason ? ` · ${suggestion.reason}` : ''}
                      </>
                    ) : (
                      'No suggested order'
                    )}
                    {pending && ' · Pending in Revolut — accept once it completes'}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{gbp2(Number(row.amount) || 0)}</span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    <button
                      type="button"
                      className={btn}
                      disabled={!acceptable || !chosen || busy}
                      onClick={() => accept.mutate({ row, orderId: chosen })}
                    >
                      Accept
                    </button>
                    <button type="button" className={btn} disabled={busy} onClick={() => setPicking(picking === row.id ? null : row.id)}>
                      Pick order
                    </button>
                    <button type="button" className={btn} disabled={busy} onClick={() => ignore.mutate(row)}>
                      Ignore
                    </button>
                  </span>
                </div>
                {picking === row.id && (
                  <label className="text-[12px] text-gardens-txs">
                    Order
                    <select
                      className={field}
                      value={chosen}
                      onChange={(event) => setPicked((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    >
                      <option value="">Choose an order</option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>{orderRef(order)} · {orderName(order)}</option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {queue.length > PREVIEW && (
        <button
          type="button"
          className="mt-1 inline-flex h-11 items-center px-1 text-[13px] font-semibold text-gardens-acc-dk underline lg:h-8"
          data-testid="revolut-show-all"
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
};
