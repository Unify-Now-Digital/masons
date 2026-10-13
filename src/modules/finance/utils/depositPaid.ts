/** Deposit-paid rule for the Finance stat strip: an order counts when its deposit
 * was actually paid — deposit_date set, OR a linked (orders.invoice_id or
 * invoices.order_id), non-deleted invoice that is paid (status 'paid',
 * amount_paid > 0, paid_at set, or a non-reversed 'paid' invoice_payment /
 * positive payments row). Job stage is deliberately NOT used. */
export interface DepositOrderRow { id: string; deposit_date: string | null; invoice_id: string | null }
export interface DepositInvoiceRow {
  id: string;
  order_id: string | null;
  status: string | null;
  amount_paid: number | string | null;
  paid_at: string | null;
}

export function isInvoicePaid(inv: DepositInvoiceRow, invoiceIdsWithPayment: Set<string>): boolean {
  return (
    inv.status === 'paid' ||
    (Number(inv.amount_paid) || 0) > 0 ||
    !!inv.paid_at ||
    invoiceIdsWithPayment.has(inv.id)
  );
}

export function depositPaidOrderIds(
  orders: DepositOrderRow[],
  invoices: DepositInvoiceRow[],
  invoiceIdsWithPayment: Set<string>,
): string[] {
  const paidInvoiceIds = new Set<string>();
  const paidOrderIds = new Set<string>();
  for (const inv of invoices) {
    if (!isInvoicePaid(inv, invoiceIdsWithPayment)) continue;
    paidInvoiceIds.add(inv.id);
    if (inv.order_id) paidOrderIds.add(inv.order_id);
  }
  return orders
    .filter(
      (o) =>
        !!o.deposit_date ||
        (o.invoice_id != null && paidInvoiceIds.has(o.invoice_id)) ||
        paidOrderIds.has(o.id),
    )
    .map((o) => o.id);
}
