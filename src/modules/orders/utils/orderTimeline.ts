import type { Order } from '../types/orders.types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type OrderTimelineSource = 'deposit' | 'stripe' | 'revolut';
export type OrderTimelineColour = 'green' | 'amber' | 'red';

export interface OrderTimeline {
  startDate: string;
  source: OrderTimelineSource;
  isLegacyFallback: boolean;
  currentDay: number;
  totalDays: number;
  percentage: number;
  daysOverdue: number;
  colour: OrderTimelineColour;
  label: string;
}

type TimelineOrder = Pick<Order, 'person' | 'invoice' | 'order_payments' | 'deposit_date' | 'timeline_weeks'>;

function validTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function earliestDate(values: Array<string | null | undefined>): string | null {
  return values
    .map((value) => ({ value, time: validTime(value) }))
    .filter((item): item is { value: string; time: number } => item.time !== null && typeof item.value === 'string')
    .sort((a, b) => a.time - b.time)[0]?.value ?? null;
}

function paymentClock(order: TimelineOrder): { date: string; source: OrderTimelineSource } | null {
  // deposit_date is the primary timeline start when present
  if (order.deposit_date && validTime(order.deposit_date) !== null) {
    return { date: order.deposit_date, source: 'deposit' };
  }

  const invoice = order.invoice;
  if (invoice?.paid_at && validTime(invoice.paid_at) !== null) {
    return { date: invoice.paid_at, source: 'stripe' };
  }

  const paidInvoicePayment = earliestDate(
    invoice?.invoice_payments?.filter((payment) => payment.status === 'paid').map((payment) => payment.created_at) ?? [],
  );
  if (paidInvoicePayment) return { date: paidInvoicePayment, source: 'stripe' };

  const invoiceIsPaid = invoice?.status === 'paid' || invoice?.stripe_status === 'paid';
  if (invoiceIsPaid && invoice?.payment_date && validTime(invoice.payment_date) !== null) {
    return { date: invoice.payment_date, source: 'stripe' };
  }

  const revolutPayment = earliestDate(
    order.order_payments
      ?.filter((payment) => payment.source === 'revolut' && payment.status === 'matched')
      .map((payment) => payment.received_at) ?? [],
  );
  if (revolutPayment) return { date: revolutPayment, source: 'revolut' };

  return null;
}

/** Returns null unless the order belongs to a customer and has a usable start clock (deposit_date first). */
export function getOrderTimeline(order: TimelineOrder, now: Date = new Date()): OrderTimeline | null {
  if (order.person?.is_customer !== true) return null;
  const clock = paymentClock(order);
  const nowTime = now.getTime();
  const startTime = clock ? validTime(clock.date) : null;
  if (!clock || startTime === null || !Number.isFinite(nowTime)) return null;

  const weeks = typeof order.timeline_weeks === 'number' && order.timeline_weeks > 0
    ? order.timeline_weeks
    : 12;
  const totalDays = weeks * 7;
  const elapsedDays = Math.max(0, Math.floor((nowTime - startTime) / DAY_MS));
  const currentDay = elapsedDays + 1;
  const daysOverdue = Math.max(0, currentDay - totalDays);
  const percentage = Math.min(100, (currentDay / totalDays) * 100);
  const daysRemaining = Math.max(0, totalDays - currentDay);
  const colour: OrderTimelineColour = daysOverdue > 0
    ? 'red'
    : daysRemaining <= 7 || percentage > 80
      ? 'amber'
      : 'green';

  return {
    startDate: clock.date,
    source: clock.source,
    isLegacyFallback: false,
    currentDay,
    totalDays,
    percentage,
    daysOverdue,
    colour,
    label: daysOverdue > 0 ? `${daysOverdue} days overdue` : `Day ${currentDay} of ${totalDays}`,
  };
}
