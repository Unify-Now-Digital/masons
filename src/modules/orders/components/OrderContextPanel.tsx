import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { formatPhoneDisplay } from '@/modules/inbox/utils/contactTitle';
/**
 * THE context panel (Oct 2026): one component for the Inbox right panel, the mobile
 * bottom sheet and the Orders drawer. Fixed section order:
 *   Header → Next action → Money → Progress → Supplier → Order details → Contact → Other orders
 * (+ optional trailing sections: History, Messages). Each section is collapsible and
 * its state is remembered across surfaces (PanelBlock / localStorage).
 * Read-only apart from the fixing date (FixingDateField, 15 Oct 2026); otherwise
 * navigation and callbacks only.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ClipboardList, ExternalLink, FileText, Info, ListOrdered, MapPin, PoundSterling, Receipt,
  Route, Truck, User, Zap, type LucideIcon,
} from 'lucide-react';
import type { Order } from '../types/orders.types';
import { getOrderDisplayId } from '../utils/orderDisplayId';
import { getOrderPermitCost, getOrderTotal, getOrderTotalFormatted } from '../utils/orderCalculations';
import { formatOrderTypeLabel } from '../utils/orderTypeDisplay';
import { transformOrderForUI } from '../utils/orderTransform';
import { orderNextAction } from '../utils/orderNextAction';
import { useOrdersByPersonId } from '../hooks/useOrders';
import { FixingDateField } from './FixingDateField';
import { useCustomer, type Customer } from '@/modules/customers/hooks/useCustomers';
import { useOrderPaymentsByOrder } from '@/modules/payments/hooks/useOrderPaymentsByOrder';
import { FactList, LeadSourcePill, NextActionPill, PANEL_PRIMARY, PanelBlock, PanelHeader, ProgressTrack, useSectionState } from '@/shared/components/mason';
import type { OrderPanelSection } from '@/shared/context/orderPanel';
import { panelMoney, type ContextPanelSection } from '@/shared/lib/contextPanel';
import { displayPersonName, tidyStoredName } from '@/shared/lib/personName';
import { progressTrack } from '@/shared/lib/orderPanel';
import { formatDateDMY, formatGbpDecimal } from '@/shared/lib/formatters';
import { yesNo } from '@/shared/lib/paymentStatusLabel';
import { moneyFigure } from '@/modules/invoicing/invoiceBuilderAccess';
import { formatLondonDate } from '@/modules/finance/londonTime';
import { cn } from '@/shared/lib/utils';
import { resolveAttribution } from '@/shared/lib/leadSource';
import { RecordPaymentDialog } from '@/modules/finance/components/RecordPaymentDialog';
import type { Receivable } from '@/modules/finance/receivables';
import { SupplierOrderSection } from '@/modules/supplier/components/SupplierStatusLabel';

interface ExtraPanelSection {
  id: ContextPanelSection;
  title: string;
  icon: LucideIcon;
  node: React.ReactNode;
}

export interface OrderContextPanelProps {
  order: Order;
  /** Overrides the person lookup (Inbox already has it loaded). */
  person?: Customer;
  /** Other orders for this customer; defaults to all of the person's orders. */
  customerOrders?: Order[];
  onSelectOrder?: (orderId: string) => void;
  /** "New order" in section 7. Omitted → button hidden; `newOrderHint` explains why. */
  onNewOrder?: () => void;
  newOrderBusy?: boolean;
  newOrderHint?: string | null;
  /** Opens the Create-invoice drawer when the order has no invoice yet. */
  onCreateInvoice?: (kind?: 'deposit' | 'balance') => void;
  onRecordPayment?: () => void;
  onEditContact?: () => void;
  /** Icon buttons at the top-right of the header (edit). Close is `onClose`. */
  headerActions?: React.ReactNode;
  onClose?: () => void;
  /** Inbox: link to the full Orders drawer. */
  showOpenFullOrder?: boolean;
  /** Rendered above the sections (e.g. quote enquiry card). */
  before?: React.ReactNode;
  /** Trailing sections after "Other orders" (History, Messages). */
  extraSections?: ExtraPanelSection[];
  className?: string;
  /** Scroll this stage into view after open (IA-8.2). */
  focusSection?: OrderPanelSection | null;
}

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gardens-bdr bg-gardens-surf px-3 text-[13px] font-medium text-gardens-tx hover:bg-gardens-page disabled:opacity-50 disabled:pointer-events-none text-center';

export const OrderContextPanel: React.FC<OrderContextPanelProps> = ({
  order, person: personProp, customerOrders, onSelectOrder, onNewOrder, newOrderBusy, newOrderHint,
  onCreateInvoice, onRecordPayment, onEditContact, headerActions, onClose, showOpenFullOrder, before, extraSections, className,
  focusSection,
}) => {
  const navigate = useNavigate();
  const { isOpen, toggle, ensureOpen } = useSectionState();
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: fetchedPerson } = useCustomer(personProp ? '' : order.person_id ?? '');
  const person = personProp ?? fetchedPerson;
  const { data: personOrders = [] } = useOrdersByPersonId(customerOrders ? null : order.person_id);
  const { data: payments = [] } = useOrderPaymentsByOrder(order.id);

  const ui = useMemo(() => transformOrderForUI(order), [order]);
  const action = orderNextAction(ui);
  const permit = getOrderPermitCost(order);
  const money = panelMoney(getOrderTotal(order), permit, payments);
  const inv = order.invoice_id;

  const personName = person ? (displayPersonName(person.first_name, person.last_name) ?? '') : '';
  const customer = personName || tidyStoredName(order.person_name) || tidyStoredName(order.customer_name) || '—';
  const deceasedName = tidyStoredName(order.customer_name);
  const deceased = deceasedName && deceasedName !== customer ? deceasedName : null;

  const collect = (amount: 'deposit' | 'full') =>
    inv
      ? navigate(`/dashboard/finance?invoice=${encodeURIComponent(inv)}&focus=collect&amount=${amount}`)
      : onCreateInvoice?.(amount === 'full' ? 'balance' : 'deposit');
  const invoiceDisabled = !inv && !onCreateInvoice;
  // Record payment: the Finance (today-finance) Record payment dialog, opened in place.
  const [paying, setPaying] = useState(false);
  // Finance roles only (same rule as the record_manual_payment DB function).
  const canRecordPayment = useCanSeeMoney();
  const recordPayment = () => {
    if (!canRecordPayment) return;
    if (onRecordPayment) onRecordPayment(); else setPaying(true);
  };

  // Section 2: the one primary button for the next action.
  // Deposit, balance and create-invoice open the invoice builder or Finance. Staff keep the
  // status pill and the New order button; they do not build or send invoices.
  const moneyKind = action.kind === 'deposit' || action.kind === 'balance' || action.kind === 'order';
  const primary: { label: string; run: () => void; disabled?: boolean } | null =
    !canRecordPayment && moneyKind
      ? null
      : action.kind === 'deposit'
      ? { label: 'Request deposit', run: () => collect('deposit'), disabled: invoiceDisabled }
      : action.kind === 'balance'
        ? { label: 'Request balance', run: () => collect('full'), disabled: invoiceDisabled }
        : action.kind === 'order'
          ? { label: 'Create invoice', run: () => collect('deposit'), disabled: invoiceDisabled }
          : action.kind === 'follow'
            ? { label: 'Reply', run: () => navigate(`/dashboard/inbox`) }
            : null;

  const receivable: Receivable = {
    orderId: order.id, ref: getOrderDisplayId(order), name: customer, total: money.total, paid: money.paid,
    remaining: money.balanceDue, sources: [], depositIn: money.paid > 0 || !!order.deposit_date,
    installationDate: order.installation_date ?? null, stoneStatus: order.stone_status ?? null, openInvoice: null,
    action: money.paid > 0 ? 'Request balance' : 'Record payment', colour: 'blue', why: '', ageDays: null, jobStage: null,
  };

  const productName = order.custom_product_name?.trim() || order.quote_product_name?.trim() || null;
  const stone = [order.material, order.color && order.color !== order.material ? order.color : null].filter(Boolean).join(', ');
  const cemetery = [order.location, order.sku ? `plot ${order.sku}` : null].filter(Boolean).join(' · ');

  const others = (customerOrders ?? personOrders).filter((o) => o.id !== order.id);
  const email = person?.email || order.customer_email;
  const phone = person?.phone || order.customer_phone;
  const address = person ? [person.address, person.city, person.country].filter(Boolean).join(', ') : '';

  const block = (id: ContextPanelSection, title: string, icon: LucideIcon, node: React.ReactNode, aside?: React.ReactNode) => (
    <PanelBlock key={id} id={id} title={title} icon={icon} open={isOpen(id)} onToggle={toggle} aside={aside}>
      {node}
    </PanelBlock>
  );

  useEffect(() => {
    if (!focusSection) return;
    const blockId: ContextPanelSection = focusSection === 'payments' ? 'money' : focusSection === 'fixing' ? 'details' : 'progress';
    const selector = focusSection === 'payments' ? '[data-section="money"]' : `[data-section="${focusSection}"]`;
    ensureOpen(blockId);
    const timer = window.setTimeout(() => {
      rootRef.current?.querySelector(selector)?.scrollIntoView({ block: 'start' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusSection, order.id, ensureOpen]);

  const pounds = canRecordPayment ? `£${Math.round(getOrderTotal(order)).toLocaleString('en-GB')}` : '';
  const status = order.payment_status;
  const primaryButton = primary ? (
    <button type="button" data-testid="panel-primary" className={PANEL_PRIMARY} onClick={primary.run} disabled={primary.disabled}>
      {primary.label} <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  ) : null;

  return (
    <div ref={rootRef} className={cn('flex h-full min-h-0 flex-col text-gardens-tx', className)} data-testid="order-context-panel">
      <PanelHeader
        kicker={<span className="tabular-nums">{pounds ? `${getOrderDisplayId(order)} · ${pounds}` : getOrderDisplayId(order)}</span>}
        name={customer}
        source={(
          <>
            {(deceased || productName) && (
              <span className="min-w-0 break-words text-[14px] leading-5 text-gardens-txs">
                {deceased ? `In memory of ${deceased}` : productName}
              </span>
            )}
            <LeadSourcePill {...resolveAttribution(order.job, order.job?.enquiry)} />
          </>
        )}
        action={primaryButton}
        extra={headerActions}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      {before}

      {/* 2. Next action */}
      {block('next', 'Next action', Zap, (
        <div className="flex flex-col gap-2">
          {action.kind !== 'none' && <NextActionPill action={action} />}
          {action.reason && <p className="m-0 text-[13px] text-gardens-txs">{action.reason}</p>}
          {!primary && (
            <p className="m-0 text-[13px] text-gardens-txs">
              {action.kind === 'waiting' ? `${action.label} — nothing for us to do.` : 'Nothing to do on this order.'}
            </p>
          )}
          {primary?.disabled && <p className="m-0 text-[12px] text-gardens-txm-aa">Link an active job to create the invoice.</p>}
        </div>
      ))}

      {/* 3. Money */}
      {block('money', 'Money', PoundSterling, (
        <div className="flex flex-col gap-3">
          {!canRecordPayment ? (
            <div className="flex flex-col rounded-lg border border-gardens-bdr overflow-hidden divide-y divide-gardens-bdr">
              <MoneyStat label="Deposit received" value={yesNo(status?.deposit_received)} tone={status?.deposit_received ? 'green' : 'amber'} />
              <MoneyStat label="Fully paid" value={yesNo(status?.fully_paid)} tone={status?.fully_paid ? 'green' : 'neutral'} />
              <MoneyStat label="Balance outstanding" value={yesNo(status?.balance_outstanding)} tone={status?.balance_outstanding ? 'amber' : 'green'} />
            </div>
          ) : (
          <div className="flex flex-col rounded-lg border border-gardens-bdr overflow-hidden divide-y divide-gardens-bdr">
            <MoneyStat
              label={money.depositPaid ? 'Deposit paid' : 'Deposit'}
              value={formatGbpDecimal(money.depositTarget)}
              tone={money.depositPaid ? 'green' : 'amber'}
            />
            <MoneyStat label="Paid" value={formatGbpDecimal(money.paid)} tone={money.paid > 0 ? 'green' : 'neutral'} />
            <MoneyStat label="Balance due" value={formatGbpDecimal(money.balanceDue)} tone={money.balanceDue > 0 ? 'amber' : 'green'} />
          </div>
          )}
          {canRecordPayment && <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gardens-txs hover:bg-gardens-page"
              title={`Deposit is 50% of the memorial + 100% of the permit fee${permit > 0 ? ` (${formatGbpDecimal(permit)})` : ''}. Balance = order value${permit > 0 ? ' + permit' : ''} − payments received.`}
              aria-label="How the deposit is worked out"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>}
          {canRecordPayment && payments.length > 0 && (
            <ul className="m-0 list-none space-y-1 p-0" data-testid="order-panel-payments">
              {payments.map((payment) => {
                const state = (payment.provider_state ?? '').toLowerCase();
                const label = payment.counterparty_name || payment.reference || (payment.source ?? 'Payment');
                const waiting = payment.status !== 'matched';
                return (
                  <li key={payment.id} className="flex items-baseline justify-between gap-2 text-[12px] text-gardens-txs">
                    <span className="min-w-0 truncate">
                      {formatLondonDate(payment.received_at)} · {label}
                      {waiting ? ` · ${state || payment.status}` : ''}
                    </span>
                    <span className="shrink-0 tabular-nums text-gardens-tx">{formatGbpDecimal(Number(payment.amount) || 0)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {canRecordPayment && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={cn(BTN, 'flex-1 min-w-[8.5rem]')} disabled={invoiceDisabled} onClick={() => collect('deposit')}>
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden /> Deposit invoice
            </button>
            <button type="button" className={cn(BTN, 'flex-1 min-w-[8.5rem]')} disabled={invoiceDisabled} onClick={() => collect('full')}>
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden /> Balance invoice
            </button>
            <button type="button" className={cn(BTN, 'w-full')} onClick={recordPayment}>
              <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden /> Record payment
            </button>
          </div>
          )}
          {canRecordPayment && invoiceDisabled && <p className="m-0 text-[12px] text-gardens-txm-aa">No invoice yet. Link an active job to create one.</p>}
        </div>
      ), canRecordPayment ? (money.balanceDue > 0 ? `${formatGbpDecimal(money.balanceDue)} due` : 'Paid') : (status?.balance_outstanding ? 'Balance outstanding' : status?.fully_paid ? 'Fully paid' : undefined))}

      {/* 4. Progress */}
      {block('progress', 'Progress', Route, (
        <div className="flex flex-col gap-3">
          <div data-section="stone" />
          <div data-section="permit" />
          <div data-section="proof" />
          <ProgressTrack
            steps={progressTrack({
              stoneStatus: order.stone_status, permitStatus: order.permit_status, proofStatus: order.proof_status,
              installationDate: order.installation_date, depositDate: order.deposit_date, jobPaidAt: ui.jobPaidAt ?? null,
              secondPaymentDate: order.second_payment_date, total: ui.total, permit, amountPaidPence: null, remainingPence: null,
            })}
          />
        </div>
      ))}

      {block('supplier', 'Supplier', Truck, (
        <SupplierOrderSection orderId={order.id} organizationId={order.organization_id ?? null} />
      ))}

      {/* 5. Order details */}
      {block('details', 'Order details', ClipboardList, (
        <div className="flex flex-col gap-3">
          <FactList
            rows={[
              { label: 'Stone', value: stone || '—' },
              { label: 'Memorial', value: productName || formatOrderTypeLabel(order.order_type) },
              { label: 'Cemetery', value: cemetery ? <span className="inline-flex items-start gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gardens-txs" aria-hidden />{cemetery}</span> : '—' },
              ...(canRecordPayment ? [{ label: 'Permit fee', value: permit > 0 ? formatGbpDecimal(permit) : '—' }] : []),
              { label: 'Deceased', value: deceased || '—' },
              { label: 'Fixing date', value: <div data-section="fixing"><FixingDateField orderId={order.id} value={order.installation_date} /></div> },
            ]}
          />
          <div className="flex flex-wrap gap-1.5">
            {canRecordPayment && inv && (
              <button type="button" className={cn(BTN, 'flex-1')} onClick={() => navigate(`/dashboard/finance?invoice=${encodeURIComponent(inv)}`)}>
                <FileText className="h-3.5 w-3.5" aria-hidden /> View invoice
              </button>
            )}
            {showOpenFullOrder && (
              <button type="button" className={cn(BTN, 'flex-1')} onClick={() => navigate(`/dashboard/orders?order=${encodeURIComponent(order.id)}`)}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open full order
              </button>
            )}
          </div>
        </div>
      ))}

      {/* 6. Contact */}
      {block('contact', 'Contact', User, (
        <div className="flex flex-col gap-2">
          <FactList
            rows={[
              { label: 'Name', value: customer },
              { label: 'Email', value: email ? <a className="inline-flex min-h-10 items-start break-all hover:underline" href={`mailto:${email}`}>{email}</a> : '—' },
              { label: 'Phone', value: phone ? <a className="inline-flex min-h-10 items-start hover:underline" href={`tel:${phone}`}>{formatPhoneDisplay(phone)}</a> : '—' },
              { label: 'Address', value: address || '—' },
            ]}
          />
          {onEditContact && person && (
            <button type="button" className={BTN} onClick={onEditContact}>Edit contact</button>
          )}
        </div>
      ))}

      {/* 7. Other orders */}
      {block('orders', 'Other orders', ListOrdered, (
        <div className="flex flex-col gap-1.5">
          {others.length === 0 && <p className="m-0 text-[13px] text-gardens-txs">No other orders for {customer}.</p>}
          {others.map((o) => {
            const figure = moneyFigure(getOrderTotalFormatted(o), canRecordPayment);
            return (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelectOrder?.(o.id)}
              disabled={!onSelectOrder}
              className="flex min-h-11 w-full items-start justify-between gap-2 rounded-lg border border-gardens-bdr px-3 py-2 text-left hover:bg-gardens-page disabled:pointer-events-none"
            >
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold tabular-nums">{getOrderDisplayId(o)}</span>
                <span className="block text-[12px] text-gardens-txs break-words">
                  {formatOrderTypeLabel(o.order_type)}{o.due_date ? ` · Due ${formatDateDMY(o.due_date)}` : ''}
                </span>
              </span>
              {figure && <span className="shrink-0 text-[13px] tabular-nums">{figure}</span>}
            </button>
            );
          })}
          {onNewOrder ? (
            <button type="button" className={BTN} onClick={onNewOrder} disabled={newOrderBusy}>
              {newOrderBusy ? 'Preparing…' : '+ New order'}
            </button>
          ) : newOrderHint ? (
            <p className="m-0 text-[12px] text-gardens-txm-aa">{newOrderHint}</p>
          ) : null}
        </div>
      ), others.length || undefined)}

      {extraSections?.map((s) => block(s.id, s.title, s.icon, s.node))}
      {paying && canRecordPayment && <RecordPaymentDialog receivable={receivable} onClose={() => setPaying(false)} />}
      </div>
    </div>
  );
};

const STAT_TONE = {
  green: 'bg-gardens-na-green-lt',
  amber: 'bg-gardens-na-amber-lt',
  neutral: 'bg-gardens-page',
} as const;

const MoneyStat: React.FC<{ label: string; value: string; tone: keyof typeof STAT_TONE }> = ({ label, value, tone }) => (
  <div className={cn('flex items-baseline justify-between gap-2 px-3 py-1.5', STAT_TONE[tone])}>
    <span className="text-[13px] text-gardens-txs">{label}</span>
    <span className="font-head text-[15px] font-semibold tabular-nums">{value}</span>
  </div>
);
