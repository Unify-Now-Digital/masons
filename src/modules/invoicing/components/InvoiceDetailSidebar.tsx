import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { X, Calendar, Plus, Copy, ExternalLink, Send, FileEdit, AlertTriangle } from 'lucide-react';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import { usePermitForms } from '@/modules/permitForms/hooks/usePermitForms';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';
import { useToast } from '@/shared/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Invoice } from '../types/invoicing.types';
import type { Order } from '@/modules/orders/types/orders.types';
import {
  getOrderTotalFormatted,
  getOrderBaseValue,
  getOrderPermitCost,
  getOrderAdditionalOptionsTotal,
  getOrderTotal,
} from '@/modules/orders/utils/orderCalculations';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { createCheckoutSession, createStripeInvoice, sendStripeInvoice, createInvoicePaymentLink } from '../api/stripe.api';
import type { CreateStripeInvoiceResponse } from '../api/stripe.api';
import { invoicesKeys, useInvoicePayments } from '../hooks/useInvoices';
import { formatDateDMY, formatGbpDecimal, formatGbpPence } from '@/shared/lib/formatters';

interface InvoiceDetailSidebarProps {
  invoice: Invoice | null;
  onClose: () => void;
  onReviseInvoice?: (invoice: Invoice) => void;
  onSelectInvoice?: (invoiceId: string) => void;
  /** Called after Stripe invoice creation so parent can merge response into selected invoice (immediate UI update) */
  onStripeInvoiceCreated?: (data: CreateStripeInvoiceResponse) => void;
  focusCollectPayment?: boolean;
  onCollectFocused?: () => void;
}

function getStripePillClass(stripeStatus: string | null | undefined): string {
  switch (stripeStatus) {
    case 'paid': return 'bg-green-100 text-green-700';
    case 'pending': return 'bg-amber-100 text-amber-700';
    case 'open': return 'bg-blue-100 text-blue-700';
    case 'draft': return 'bg-slate-100 text-slate-600';
    case 'void': return 'bg-slate-100 text-slate-500';
    case 'uncollectible': return 'bg-red-100 text-red-700';
    case 'payment_failed': return 'bg-red-100 text-red-700';
    case 'unpaid':
    default: return 'bg-slate-100 text-slate-600';
  }
}

// Use shared formatters for consistent GBP/date display across the app.
const formatPence = formatGbpPence;

export const InvoiceDetailSidebar: React.FC<InvoiceDetailSidebarProps> = ({
  invoice,
  onClose,
  onReviseInvoice,
  onSelectInvoice,
  onStripeInvoiceCreated,
  focusCollectPayment,
  onCollectFocused,
}) => {
  const [createOrderDrawerOpen, setCreateOrderDrawerOpen] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [createStripeLoading, setCreateStripeLoading] = useState(false);
  const [sendInvoiceLoading, setSendInvoiceLoading] = useState(false);
  const [requestPaymentDisabled, setRequestPaymentDisabled] = useState(false);
  const [requestPaymentDisabledReason, setRequestPaymentDisabledReason] = useState<string | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState<string>('');
  const [collectPercentInput, setCollectPercentInput] = useState<string>('');
  const [collectLoading, setCollectLoading] = useState(false);
  const [lastCheckoutUrl, setLastCheckoutUrl] = useState<string | null>(null);
  const [lastCheckoutAmountPence, setLastCheckoutAmountPence] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: orders, isLoading: isOrdersLoading } = useOrdersByInvoice(invoice?.id ?? null);
  const { data: payments = [], isLoading: paymentsLoading } = useInvoicePayments(invoice?.id ?? null);
  const { data: permitFormsList = [] } = usePermitForms();
  const permitFormNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    permitFormsList.forEach((pf) => { map[pf.id] = pf.name ?? 'Permit'; });
    return map;
  }, [permitFormsList]);
  const getOrderDisplayName = React.useCallback((order: Order): string => {
    if (order.order_type === 'Renovation') {
      const service = order.renovation_service_description?.trim();
      return service || 'Renovation';
    }
    return 'New Memorial';
  }, []);
  const collectCardRef = useRef<HTMLDivElement | null>(null);

  // Derived values used by useEffect — must be computed before any return so hook order is stable
  const amountRemainingPence = invoice?.amount_remaining != null ? Number(invoice.amount_remaining) : null;
  const hasRemaining = amountRemainingPence != null && amountRemainingPence > 0;
  let suggestedDepositPence = 0;
  if (orders?.length) {
    for (const o of orders) {
      const permit = (o.permit_cost ?? 0) * 100;
      const base = (o.order_type === 'Renovation' ? (o.renovation_service_cost ?? 0) : (o.value ?? 0)) * 100;
      const options = (o.additional_options_total ?? 0) * 100;
      suggestedDepositPence += permit + 0.5 * (base + options);
    }
    suggestedDepositPence = Math.round(suggestedDepositPence);
  }

  // Single useEffect: always declared; early-return inside when invoice/remaining missing
  useEffect(() => {
    if (!invoice?.id || amountRemainingPence == null || !hasRemaining) {
      setCollectAmountInput('');
      setCollectPercentInput('');
      setLastCheckoutUrl(null);
      setLastCheckoutAmountPence(null);
      return;
    }
    const base = amountRemainingPence;
    let def = base;
    if (suggestedDepositPence > 0) {
      def = Math.min(suggestedDepositPence, base);
    }
    if (def <= 0) {
      setCollectAmountInput('');
      setCollectPercentInput('');
      return;
    }
    setCollectAmountInput((def / 100).toFixed(2));
    const percent =
      amountRemainingPence > 0 ? (def / amountRemainingPence) * 100 : 0;
    setCollectPercentInput(percent > 0 ? percent.toFixed(1) : '');
    setLastCheckoutUrl(null);
    setLastCheckoutAmountPence(null);
  }, [invoice?.id, hasRemaining, amountRemainingPence, suggestedDepositPence]);

  // Scroll collect payment card into view when requested
  useEffect(() => {
    if (!focusCollectPayment) return;
    if (!invoice?.stripe_invoice_id || !hasRemaining) return;
    if (!collectCardRef.current) return;

    collectCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const amountInput = collectCardRef.current.querySelector<HTMLInputElement>('#collect-amount');
    amountInput?.focus();

    onCollectFocused?.();
  }, [focusCollectPayment, invoice?.stripe_invoice_id, hasRemaining, onCollectFocused]);

  if (!invoice) return null;

  const isPaid = invoice.status === 'paid' || invoice.stripe_status === 'paid' || invoice.stripe_invoice_status === 'paid';
  const stripeStatus = invoice.stripe_invoice_status ?? invoice.stripe_status ?? 'unpaid';
  const isLocked = (invoice.amount_paid != null && Number(invoice.amount_paid) > 0) || !!invoice.locked_at;
  const amountPaidPence = invoice.amount_paid != null ? Number(invoice.amount_paid) : 0;
  const hasHostedUrl = !!invoice.hosted_invoice_url?.trim();

  const handleCopyPaymentLink = async () => {
    if (isPaid) return;
    setCopyLoading(true);
    try {
      const { url } = await createCheckoutSession(invoice.id);
      await navigator.clipboard.writeText(url);
      toast({ title: 'Payment link copied', description: 'Share the link with the customer.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not create payment link',
        description: e instanceof Error ? e.message : 'Something went wrong.',
      });
    } finally {
      setCopyLoading(false);
    }
  };

  const handleCreateStripeInvoice = async () => {
    if (isPaid) return;
    setCreateStripeLoading(true);
    try {
      const data = await createStripeInvoice(invoice.id);
      onStripeInvoiceCreated?.(data);
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoice.id) });
      if (data.hosted_invoice_url) {
        window.open(data.hosted_invoice_url, '_blank');
        toast({ title: 'Stripe invoice ready', description: 'Hosted link opened in new tab.' });
      } else {
        toast({ title: 'Stripe invoice created', description: 'Request payment to send the link.' });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not create Stripe invoice',
        description: e instanceof Error ? e.message : 'Something went wrong.',
      });
    } finally {
      setCreateStripeLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    if (isPaid) return;
    setSendInvoiceLoading(true);
    try {
      const data = await sendStripeInvoice(invoice.id);
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoice.id) });
      queryClient.invalidateQueries({ queryKey: invoicesKeys.payments(invoice.id) });
      if (data.hosted_invoice_url) {
        window.open(data.hosted_invoice_url, '_blank');
        toast({ title: 'Invoice sent', description: 'Hosted link opened; share with customer for payment.' });
      } else {
        toast({ title: 'Invoice sent', description: 'Share the hosted link with the customer.' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      if (message.includes('Customer email required to email invoice.')) {
        setRequestPaymentDisabled(true);
        setRequestPaymentDisabledReason(message);
      }
      toast({
        variant: 'destructive',
        title: 'Could not send invoice',
        description: message,
      });
    } finally {
      setSendInvoiceLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-700";
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "overdue": return "bg-red-100 text-red-700";
      case "draft": return "bg-gray-100 text-gray-700";
      case "cancelled": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return formatDateDMY(dateString);
  };

  const formatCurrency = (amount: number) => {
    return formatGbpDecimal(amount);
  };

  const handleAmountChange = (raw: string) => {
    setCollectAmountInput(raw);

    const normalised = raw.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalised);
    if (!Number.isFinite(parsed) || amountRemainingPence == null || amountRemainingPence <= 0) {
      return;
    }

    let pence = Math.round(parsed * 100);
    if (pence < 1) pence = 1;
    if (pence > amountRemainingPence) pence = amountRemainingPence;

    const percent = (pence / amountRemainingPence) * 100;
    setCollectPercentInput(percent.toFixed(1));
  };

  const handleAmountBlur = () => {
    const normalised = collectAmountInput.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalised);
    if (!Number.isFinite(parsed) || amountRemainingPence == null || amountRemainingPence <= 0) {
      return;
    }

    let pence = Math.round(parsed * 100);
    if (pence < 1) pence = 1;
    if (pence > amountRemainingPence) pence = amountRemainingPence;

    setCollectAmountInput((pence / 100).toFixed(2));

    const percent = (pence / amountRemainingPence) * 100;
    setCollectPercentInput(percent.toFixed(1));
  };

  const handlePercentChange = (raw: string) => {
    setCollectPercentInput(raw);

    const normalised = raw.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalised);
    if (!Number.isFinite(parsed) || amountRemainingPence == null || amountRemainingPence <= 0) {
      return;
    }

    let percent = parsed;
    if (percent < 0.01) percent = 0.01;
    if (percent > 100) percent = 100;

    let pence = Math.round(amountRemainingPence * (percent / 100));
    if (pence < 1) pence = 1;
    if (pence > amountRemainingPence) pence = amountRemainingPence;

    setCollectAmountInput((pence / 100).toFixed(2));
  };

  const handlePercentBlur = () => {
    const normalised = collectPercentInput.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalised);
    if (!Number.isFinite(parsed) || amountRemainingPence == null || amountRemainingPence <= 0) {
      return;
    }

    let percent = parsed;
    if (percent < 0.01) percent = 0.01;
    if (percent > 100) percent = 100;

    setCollectPercentInput(percent.toFixed(1));

    let pence = Math.round(amountRemainingPence * (percent / 100));
    if (pence < 1) pence = 1;
    if (pence > amountRemainingPence) pence = amountRemainingPence;

    setCollectAmountInput((pence / 100).toFixed(2));
  };

  const handleGenerateCheckoutLink = async () => {
    if (!invoice || !hasRemaining || !amountRemainingPence) return;
    let input = collectAmountInput?.trim();
    if (!input) {
      toast({
        variant: 'destructive',
        title: 'Amount required',
        description: 'Enter an amount to collect.',
      });
      return;
    }
    // Parse pounds input; allow comma or dot
    input = input.replace(',', '.');
    const parsed = Number.parseFloat(input);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid amount',
        description: 'Enter a positive amount.',
      });
      return;
    }
    let pence = Math.round(parsed * 100);
    if (pence > amountRemainingPence) {
      pence = amountRemainingPence;
    }
    if (pence <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid amount',
        description: 'Amount must be at least £0.01 and not exceed the remaining balance.',
      });
      return;
    }

    setCollectLoading(true);
    try {
      const data = await createInvoicePaymentLink(invoice.id, pence);
      setLastCheckoutUrl(data.checkout_url);
      setLastCheckoutAmountPence(pence);
      toast({
        title: 'Checkout link created',
        description: 'Share the link with the customer to collect payment.',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not create Checkout link',
        description: e instanceof Error ? e.message : 'Something went wrong.',
      });
    } finally {
      setCollectLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between p-4 border-b bg-background">
        <div>
          <h2 className="text-xl font-semibold">Invoice Details</h2>
          <p className="text-sm text-muted-foreground">{invoice.invoice_number}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6">
        {isLocked && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Invoice locked — payments started</p>
              <p className="text-xs text-amber-700 mt-0.5">Line items cannot be edited. Use Revise invoice to create an updated invoice.</p>
              {onReviseInvoice && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  onClick={() => onReviseInvoice(invoice)}
                >
                  <FileEdit className="h-4 w-4 mr-2" />
                  Revise invoice
                </Button>
              )}
            </div>
          </div>
        )}

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                <Badge variant="outline" className={getStripePillClass(stripeStatus)}>
                  Stripe: {stripeStatus}
                </Badge>
              </div>
            </div>
            {invoice.stripe_invoice_id && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Paid</span>
                  <span className="font-medium">{formatPence(amountPaidPence)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Remaining</span>
                  <span className="font-medium">{formatPence(amountRemainingPence)}</span>
                </div>
              </>
            )}
            {!isPaid && (
              <div className="pt-1 space-y-2">
                {!invoice.stripe_invoice_id ? (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-auto min-h-9 py-2 px-3 text-center whitespace-normal"
                    disabled={createStripeLoading}
                    onClick={handleCreateStripeInvoice}
                  >
                    {createStripeLoading ? 'Creating…' : 'Create Stripe invoice'}
                  </Button>
                ) : (
                  <>
                    {hasHostedUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="w-full h-auto min-h-9 py-2 px-3 text-center whitespace-normal"
                        onClick={() => window.open(invoice.hosted_invoice_url!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
                        Open full invoice
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={hasHostedUrl ? 'outline' : 'default'}
                      className="w-full h-auto min-h-9 py-2 px-3 text-center whitespace-normal"
                      disabled={sendInvoiceLoading || requestPaymentDisabled}
                      title={requestPaymentDisabled ? (requestPaymentDisabledReason ?? 'Customer email required to email invoice. Use hosted link instead.') : undefined}
                      onClick={handleRequestPayment}
                    >
                      <Send className="h-4 w-4 mr-2 shrink-0" />
                      {sendInvoiceLoading ? 'Sending…' : 'Request payment'}
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-auto min-h-9 py-2 px-3 text-center whitespace-normal"
                  disabled={copyLoading}
                  onClick={handleCopyPaymentLink}
                >
                  <Copy className="h-4 w-4 mr-2 shrink-0" />
                  {copyLoading ? 'Creating…' : 'Copy Checkout link'}
                </Button>
              </div>
            )}
            {invoice.revised_from_invoice_id && onSelectInvoice && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                Revised from{' '}
                <button
                  type="button"
                  className="underline hover:no-underline"
                  onClick={() => onSelectInvoice(invoice.revised_from_invoice_id!)}
                >
                  previous invoice
                </button>
              </p>
            )}
            {suggestedDepositPence > 0 && !isPaid && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                Suggested deposit (staff guidance): {formatPence(suggestedDepositPence)} (100% permit + 50% main & options)
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Customer</span>
              {invoice.customer_name?.trim() ? (
                <CustomerDetailsPopover
                  invoiceId={invoice.id}
                  fallbackName={invoice.customer_name}
                  fallbackPhone={null}
                  fallbackEmail={null}
                  trigger={<button className="text-left hover:underline font-medium">{invoice.customer_name}</button>}
                />
              ) : (
                <span className="font-medium text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(invoice.amount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Issue Date</span>
                  <span className="text-sm">{formatDate(invoice.issue_date)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <span className="text-sm">{formatDate(invoice.due_date)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost breakdown — per-order: Order N — display name, cost lines, order total */}
        {orders && orders.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cost breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {orders.map((order: Order, index: number) => {
                const base = getOrderBaseValue(order);
                const permit = getOrderPermitCost(order);
                const optionsTotalForOrder = getOrderAdditionalOptionsTotal(order);
                const hasOptions = optionsTotalForOrder > 0 || (order.additional_options && order.additional_options.length > 0);
                const displayName = getOrderDisplayName(order);
                const productLineLabel = order.order_type === 'Renovation' ? 'Renovation' : 'Main product';
                const permitFormName = order.permit_form_id
                  ? (permitFormNameById[order.permit_form_id] ?? 'Permit')
                  : 'Permit';
                const orderTotal = getOrderTotal(order);
                const orderId = getOrderDisplayId(order);
                const typeLabel = order.order_type === 'Renovation' ? 'Renovation' : 'New Memorial';
                const orderTitle = `${orderId} — ${typeLabel}: ${displayName}`;
                return (
                  <React.Fragment key={order.id}>
                    {index > 0 && <div className="border-t my-4" role="separator" aria-hidden />}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {orderTitle}
                      </h4>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-muted-foreground">{productLineLabel}</span>
                          <span className="tabular-nums">{formatCurrency(base)}</span>
                        </div>
                        {permit > 0 && (
                          <div className="flex justify-between items-baseline gap-2">
                            <span className="text-muted-foreground">{permitFormName}</span>
                            <span className="tabular-nums">{formatCurrency(permit)}</span>
                          </div>
                        )}
                        {hasOptions && (
                          order.additional_options && order.additional_options.length > 0 ? (
                            order.additional_options.map((opt) => (
                              <div key={opt.id} className="flex justify-between items-baseline gap-2 pl-1">
                                <span className="text-muted-foreground">{opt.name?.trim() || 'Option'}</span>
                                <span className="tabular-nums">{formatCurrency(typeof opt.cost === 'number' ? opt.cost : parseFloat(String(opt.cost)) || 0)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="text-muted-foreground">Additional options</span>
                              <span className="tabular-nums">{formatCurrency(optionsTotalForOrder)}</span>
                            </div>
                          )
                        )}
                        <div className="flex justify-between items-baseline gap-2 pt-1.5 border-t border-border/60">
                          <span className="font-medium text-foreground">Order total</span>
                          <span className="tabular-nums font-medium">{formatCurrency(orderTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Collect payment (partial) */}
        {invoice.stripe_invoice_id && hasRemaining && !isPaid && (
          <Card className="mb-4" ref={collectCardRef}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Collect payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">{formatPence(amountRemainingPence)}</span>
              </div>
              {suggestedDepositPence > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Suggested deposit</span>
                  <span>{formatPence(suggestedDepositPence)} (100% permit + 50% main & options)</span>
                </div>
              )}
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground" htmlFor="collect-amount">
                      Amount to collect now (GBP)
                    </label>
                    <Input
                      id="collect-amount"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={collectAmountInput}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      onBlur={handleAmountBlur}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground" htmlFor="collect-percent">
                      % of remaining
                    </label>
                    <Input
                      id="collect-percent"
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.1}
                      value={collectPercentInput}
                      onChange={(e) => handlePercentChange(e.target.value)}
                      onBlur={handlePercentBlur}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Max: {formatPence(amountRemainingPence)}. Customer will pay on Stripe Checkout.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-auto min-h-9 py-2 px-3 text-center whitespace-normal"
                  disabled={collectLoading}
                  onClick={handleGenerateCheckoutLink}
                >
                  {collectLoading ? 'Generating…' : 'Generate Checkout link'}
                </Button>
                {lastCheckoutUrl && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(lastCheckoutUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Checkout
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(lastCheckoutUrl);
                          toast({
                            title: 'Link copied',
                            description: lastCheckoutAmountPence != null
                              ? `Amount: ${formatPence(lastCheckoutAmountPence)}`
                              : undefined,
                          });
                        } catch {
                          toast({
                            variant: 'destructive',
                            title: 'Could not copy link',
                            description: 'Your browser blocked clipboard access.',
                          });
                        }
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy link
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {payments.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <ul className="space-y-2">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                      <span>{formatDate(p.created_at)}</span>
                      <span className="font-medium">{formatPence(p.amount)}</span>
                      <Badge variant="outline" className="text-xs">{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {invoice.payment_method || invoice.payment_date ? (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.payment_method && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Method</span>
                  <span className="text-sm">{invoice.payment_method}</span>
                </div>
              )}
              {invoice.payment_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Date</span>
                  <span className="text-sm">{formatDate(invoice.payment_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {invoice.notes && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Orders</CardTitle>
              {!isLocked && (
                <Button size="sm" variant="outline" onClick={() => setCreateOrderDrawerOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Order
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isOrdersLoading && <p className="text-sm text-muted-foreground">Loading orders...</p>}
            {!isOrdersLoading && (!orders || orders.length === 0) && (
              <p className="text-sm text-muted-foreground">No orders for this invoice</p>
            )}
            {!isOrdersLoading && orders && orders.length > 0 && (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.id} className="border rounded-md p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-sm text-muted-foreground">{order.order_type}</div>
                      </div>
                      <div className="text-sm font-medium">{getOrderTotalFormatted(order)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>

      <CreateOrderDrawer
        open={createOrderDrawerOpen}
        onOpenChange={setCreateOrderDrawerOpen}
        invoiceId={invoice.id}
      />
    </div>
  );
};
