import { formatGbpDecimal } from '@/shared/lib/formatters';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ClipboardCheck, Receipt } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import type { Order } from '@/modules/orders/types/orders.types';
import { getOrderPermitCost, getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import { depositPoundsFromTotal } from '@/shared/lib/deposit';
import { cn } from '@/shared/lib/utils';

import { NOT_CAPTURED, permitPackItems, type Tone } from '@/modules/inbox/utils/permitPack';

const TONE_DOT: Record<Tone, string> = {
  green: 'bg-gardens-grn',
  amber: 'bg-gardens-sem-amber',
  red: 'bg-gardens-red',
  grey: 'bg-gardens-bdr2',
};

const TRIGGER =
  'group w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gardens-txs hover:text-gardens-tx';

/** Permit pack card: collapsed by default; the header shows N/5 ready. */
export const PermitPackCard: React.FC<{ order: Order }> = ({ order }) => {
  const [open, setOpen] = useState(false);
  const items = permitPackItems(order);
  const ready = items.filter((i) => i.tone === 'green').length;
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="permit-pack-card">
      <CollapsibleTrigger className={TRIGGER}>
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">Permit pack</span>
        <span className="text-[10px] tabular-nums normal-case">{ready}/{items.length} ready</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.label} className="flex items-start gap-2 text-[12px]">
              <span className={cn('mt-[5px] h-2 w-2 rounded-full shrink-0', TONE_DOT[i.tone])} aria-hidden />
              <span className="min-w-0">
                <span className="font-medium text-gardens-tx">{i.label}</span>
                <span className="block truncate text-gardens-txs" title={i.value}>
                  {i.value.split(NOT_CAPTURED).map((part, k, arr) => (
                    <React.Fragment key={k}>
                      {part}
                      {k < arr.length - 1 && (
                        <span className="ml-0.5 rounded bg-gardens-acc-lt px-1 text-[10px] font-semibold text-gardens-acc-dk">{NOT_CAPTURED}</span>
                      )}
                    </React.Fragment>
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};

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
