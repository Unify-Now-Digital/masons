import { formatGbpDecimal } from '@/shared/lib/formatters';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import type { Order } from '@/modules/orders/types/orders.types';
import { getOrderPermitCost, getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import { depositPoundsFromTotal } from '@/shared/lib/deposit';

/**
 * Create-invoice card (hub/inbox v3): Deposit (50% memorial + 100% permit) / Balance / Pay link.
 * With an invoice: deep-links to its Collect payment card pre-filled. Without: opens the
 * existing CreateInvoiceDrawer (unchanged).
 */
export const InvoiceActionsCard: React.FC<{ order: Order; onCreateInvoice?: () => void }> = ({ order, onCreateInvoice }) => {
  const navigate = useNavigate();
  const total = getOrderTotal(order);
  const deposit = depositPoundsFromTotal(total, getOrderPermitCost(order));
  const inv = order.invoice_id;
  const go = (amount: 'deposit' | 'full') =>
    inv
      ? navigate(`/dashboard/finance?invoice=${encodeURIComponent(inv)}&focus=collect&amount=${amount}`)
      : onCreateInvoice?.();
  const btn =
    'flex-1 min-w-0 rounded-lg border border-gardens-bdr bg-white px-2 py-1 text-[11px] font-semibold text-gardens-tx hover:bg-gardens-page disabled:opacity-50';
  const disabled = !inv && !onCreateInvoice;
  return (
    <div className="px-3 py-2" data-testid="invoice-actions-card">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gardens-txs mb-1.5">
        <Receipt className="h-3.5 w-3.5" />
        <span>{inv ? 'Collect payment' : 'Create invoice'}</span>
      </div>
      <div className="flex gap-1.5">
        <button type="button" className={btn} disabled={disabled} onClick={() => go('deposit')} title="50% of the memorial + 100% of the permit fee">
          Deposit {formatGbpDecimal(deposit)}
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => go('full')}>
          Balance
        </button>
        <button type="button" className={btn} disabled={!inv} onClick={() => go('deposit')} title={inv ? 'Open the invoice to send a pay link' : 'Create the invoice first'}>
          Pay link
        </button>
      </div>
      {disabled && <p className="mt-1 text-[10.5px] text-gardens-txm-aa">Select an active job to invoice.</p>}
    </div>
  );
};
