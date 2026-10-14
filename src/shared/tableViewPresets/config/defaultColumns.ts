/**
 * Default column configurations for Orders and Invoices modules
 * These match the current hardcoded column layouts
 */

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultWidth: number;
  /** Hidden by default (still available behind Columns). */
  defaultHidden?: boolean;
}

// Orders column definitions (extracted from SortableOrdersTable)
// Keep in lockstep with orderColumnDefinitions IDs/labels/widths so drag order + widths persist.
export const ordersColumns: ColumnDefinition[] = [
  // Space pass 2026-10-14: key columns (Ref, Customer, Value, Due + the
  // fixed Next step / Actions) fit 1280px with no horizontal scroll. Customer already
  // shows "deceased · type" underneath, so Deceased/Type are secondary.
  { id: 'id', label: 'Ref', defaultWidth: 104 },
  { id: 'customer', label: 'Customer', defaultWidth: 210 },
  { id: 'customerType', label: 'Client', defaultWidth: 110, defaultHidden: true },
  { id: 'deceasedName', label: 'Deceased', defaultWidth: 150, defaultHidden: true },
  { id: 'type', label: 'Type', defaultWidth: 150, defaultHidden: true },
  { id: 'photo', label: 'Photo', defaultWidth: 60, defaultHidden: true },
  { id: 'stoneStatus', label: 'Stone', defaultWidth: 110, defaultHidden: true },
  { id: 'material', label: 'Stone Type', defaultWidth: 130, defaultHidden: true },
  { id: 'color', label: 'Stone Colour', defaultWidth: 130, defaultHidden: true },
  { id: 'value', label: 'Value', defaultWidth: 90 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 90 },
  { id: 'timeline', label: 'Timeline', defaultWidth: 140, defaultHidden: true },
  { id: 'messages', label: 'Msgs', defaultWidth: 70, defaultHidden: true },
];

// Invoices column definitions (extracted from the retired standalone Invoicing page)
export const invoicesColumns: ColumnDefinition[] = [
  { id: 'expand', label: '', defaultWidth: 50 },
  { id: 'invoiceNumber', label: 'Invoice Number', defaultWidth: 150 },
  { id: 'customer', label: 'Person', defaultWidth: 180 },
  { id: 'amount', label: 'Amount', defaultWidth: 120 },
  { id: 'mainProductTotal', label: 'Main product total', defaultWidth: 160 },
  { id: 'additionalOptionsTotal', label: 'Additional Options total', defaultWidth: 180 },
  { id: 'permitTotalCost', label: 'Permit total cost', defaultWidth: 150 },
   { id: 'paid', label: 'Paid', defaultWidth: 140 },
  { id: 'paymentProgress', label: 'Progress', defaultWidth: 140 },
   { id: 'remaining', label: 'Remaining', defaultWidth: 150 },
  { id: 'status', label: 'Status', defaultWidth: 100 },
  { id: 'stripePaymentLink', label: 'Stripe payment link', defaultWidth: 140 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 90 },
  { id: 'daysOverdue', label: 'Days overdue', defaultWidth: 170 },
  { id: 'paymentMethod', label: 'Payment Method', defaultWidth: 150 },
];

/**
 * Get column definitions for a module
 */
export function getColumnDefinitions(module: 'orders' | 'invoices'): ColumnDefinition[] {
  return module === 'orders' ? ordersColumns : invoicesColumns;
}

/**
 * Get default column order for a module
 */
export function getDefaultColumnOrder(module: 'orders' | 'invoices'): string[] {
  const columns = getColumnDefinitions(module);
  return columns.map(col => col.id);
}

/**
 * Get default column visibility for a module (visible unless defaultHidden)
 */
export function getDefaultColumnVisibility(module: 'orders' | 'invoices'): Record<string, boolean> {
  const columns = getColumnDefinitions(module);
  const visibility: Record<string, boolean> = {};
  columns.forEach(col => {
    visibility[col.id] = !col.defaultHidden;
  });
  return visibility;
}

/**
 * Get default column widths for a module
 */
export function getDefaultColumnWidths(module: 'orders' | 'invoices'): Record<string, number> {
  const columns = getColumnDefinitions(module);
  const widths: Record<string, number> = {};
  columns.forEach(col => {
    widths[col.id] = col.defaultWidth;
  });
  return widths;
}

