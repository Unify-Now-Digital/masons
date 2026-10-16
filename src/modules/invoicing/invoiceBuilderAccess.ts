/**
 * Who may build or send an invoice, and how the inbox builder totals a draft.
 * The owner keeps product prices, add-on costs and price overrides.
 * Staff get no amount and no finance navigation.
 */

export function canBuildInvoices(canSeeMoney: boolean): boolean {
  return canSeeMoney === true;
}

/**
 * Catalogue price copied onto the order when a product is chosen.
 * Staff receive null so the hidden price field cannot be filled from the catalogue.
 */
export function priceOnProductSelect(
  cataloguePrice: number | null | undefined,
  canSeeMoney: boolean,
): number | null {
  if (!canSeeMoney) return null;
  if (cataloguePrice == null || !Number.isFinite(Number(cataloguePrice))) return null;
  return Number(cataloguePrice);
}

/**
 * Price written to products.base_price.
 * Undefined means "leave the column out" so a staff save cannot post £0.
 */
export function cataloguePriceWrite(
  canSeeMoney: boolean,
  price: number | null | undefined,
): number | null | undefined {
  if (!canSeeMoney) return undefined;
  return price ?? null;
}

export interface InvoiceDraftLine {
  orderType: string;
  /** New Memorial price after any override the owner typed. */
  value: number | null;
  renovationServiceCost: number | null;
  permitCost: number | null;
  /** One cost per add-on row. There is no separate quantity field on the builder. */
  addOnCosts: Array<number | null | undefined>;
}

function money(raw: number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Inbox invoice amount: memorial price (or renovation service cost) + permit + each add-on cost.
 * Matches CreateInvoiceDrawer, which sums the same three parts before create.
 */
export function invoiceDraftTotal(lines: InvoiceDraftLine[]): number {
  const total = lines.reduce((sum, line) => {
    const base = line.orderType === 'Renovation' ? money(line.renovationServiceCost) : money(line.value);
    const addOns = line.addOnCosts.reduce((inner, cost) => inner + money(cost), 0);
    return sum + base + money(line.permitCost) + addOns;
  }, 0);
  return Math.round(total * 100) / 100;
}

/** Pound figure for an owner. Staff get null so the screen never renders £. */
export function moneyFigure(formatted: string, canSeeMoney: boolean): string | null {
  return canSeeMoney ? formatted : null;
}

export function isFinanceTarget(target: string): boolean {
  return target === '/dashboard/finance' || target.startsWith('/dashboard/finance?');
}

/** Reply stays for everyone. Finance and invoice collect targets stay with the owner. */
export function viewerPrimary<T extends { target: string }>(
  primary: T | null,
  canSeeMoney: boolean,
): T | null {
  if (!primary) return null;
  if (canBuildInvoices(canSeeMoney)) return primary;
  if (primary.target === 'composer') return primary;
  if (isFinanceTarget(primary.target)) return null;
  return primary;
}
