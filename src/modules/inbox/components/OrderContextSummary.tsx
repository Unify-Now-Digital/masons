import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import {
  getOrderTotal,
  getOrderTotalFormatted,
  getOrderPermitCost,
  getOrderAdditionalOptionsTotal,
} from '@/modules/orders/utils/orderCalculations';
import type { Order } from '@/modules/orders/types/orders.types';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import { ExternalLink, FileText, MapPin } from 'lucide-react';
import { MoneyCardView, PanelSection, ProgressTrack } from '@/shared/components/mason';
import { moneyCards, orderInvoicePence, progressTrack } from '@/shared/lib/orderPanel';
import { cn } from '@/shared/lib/utils';
import { useProductsList } from '@/modules/products/hooks/useProducts';
import { formatGbpDecimal } from '@/shared/lib/formatters';

interface OrderContextSummaryProps {
  order: Order;
  className?: string;
}

/** Order summary for right panel. Uses InboxOrderSummaryCard; only existing Order fields. */
export const OrderContextSummary: React.FC<OrderContextSummaryProps> = ({ order, className }) => {
  const navigate = useNavigate();
  const { data: products = [] } = useProductsList();

  const snapshotUrl = order.product_photo_url ?? null;
  const skuKey = (order.sku ?? '').trim().toLowerCase();
  const fallbackProduct = !snapshotUrl && skuKey
    ? products.find((p) => (p.name ?? '').trim().toLowerCase() === skuKey)
    : undefined;
  const productImageUrl = snapshotUrl ?? fallbackProduct?.image_url ?? null;

  // inbox-v11: shared order panel layout (header, 5-step track, money, key facts, actions).
  // invoices.amount_paid / amount_remaining are PENCE (converted in moneyCards).
  const invoicePence = order.invoice ? orderInvoicePence(order.invoice) : order.invoice_id ? { amountPaidPence: 0, remainingPence: null } : orderInvoicePence(null);
  const panelInput = {
    stoneStatus: order.stone_status,
    permitStatus: order.permit_status,
    proofStatus: order.proof_status,
    installationDate: order.installation_date,
    depositDate: order.deposit_date,
    jobPaidAt: order.job?.paid_at ?? null,
    secondPaymentDate: order.second_payment_date,
    total: getOrderTotal(order),
    ...invoicePence,
  };
  const money = moneyCards(panelInput);
  const optionsTotal = getOrderAdditionalOptionsTotal(order);
  const permitCost = getOrderPermitCost(order);
  const productName = order.custom_product_name?.trim() || order.quote_product_name?.trim() || fallbackProduct?.name || null;
  const facts = [
    productName ? { label: 'Product', value: productName } : null,
    order.material ? { label: 'Stone', value: order.material } : null,
    optionsTotal > 0 ? { label: 'Extras', value: formatGbpDecimal(optionsTotal) } : null,
    permitCost > 0 ? { label: 'Permit fee', value: formatGbpDecimal(permitCost) } : null,
    order.assigned_to ? { label: 'Owner', value: order.assigned_to } : null,
  ].filter((f): f is { label: string; value: string } => f != null);
  const place = [order.location, order.sku ? `plot ${order.sku}` : null].filter(Boolean).join(' · ');
  const forName = order.person_name && order.customer_name && order.person_name !== order.customer_name ? order.customer_name : null;
  const invoiceId = order.invoice_id;
  const btn =
    'w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-gardens-bdr bg-white px-2.5 h-9 text-[13px] font-medium text-gardens-tx hover:bg-gardens-page disabled:opacity-50 disabled:pointer-events-none';

  return (
    <div className={cn('flex flex-col gap-4', className)} data-testid="inbox-order-panel">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] text-gardens-txm-aa">
          {getOrderDisplayId(order)} · {formatOrderTypeLabel(order.order_type)}
        </span>
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-md bg-gardens-page border border-gardens-bdr overflow-hidden shrink-0">
            {productImageUrl ? <img src={productImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-head text-[16px] font-semibold text-gardens-tx leading-tight">
              {order.person_name || order.customer_name || '—'}
            </div>
            {forName && <div className="text-[12px] text-gardens-txs">for {forName}</div>}
          </div>
          <div className="text-right shrink-0 font-head text-[16px] font-semibold text-gardens-tx tabular-nums">
            {getOrderTotalFormatted(order)}
          </div>
        </div>
        {place && (
          <div className="flex items-center gap-1.5 text-[12px] text-gardens-txs">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place}</span>
          </div>
        )}
      </header>
      <PanelSection
        title="Progress"
        aside={order.timeline_weeks ? `${order.timeline_weeks}-week timeline · starts at deposit` : undefined}
      >
        <ProgressTrack steps={progressTrack(panelInput)} />
      </PanelSection>
      <PanelSection title="Money">
        <div className="grid grid-cols-2 gap-2">
          <MoneyCardView card={money.deposit} icon={money.deposit.tone === 'green' ? 'paid' : 'due'} />
          <MoneyCardView card={money.balance} icon={money.balance.tone === 'green' ? 'paid' : 'date'} />
        </div>
      </PanelSection>
      {facts.length > 0 && (
        <PanelSection title="Order">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] m-0">
            {facts.map((f) => (
              <React.Fragment key={f.label}>
                <dt className="text-gardens-txs">{f.label}</dt>
                <dd className="text-right text-gardens-tx m-0 truncate">{f.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </PanelSection>
      )}
      <div className="flex flex-col gap-1.5">
        {invoiceId && (
          <button
            type="button"
            onClick={() => navigate(`/dashboard/invoicing?invoice=${encodeURIComponent(invoiceId)}`)}
            className={btn}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden /> View invoice
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/dashboard/orders?order=${encodeURIComponent(order.id)}`)}
          className={btn}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open full order
        </button>
      </div>
    </div>
  );
};
