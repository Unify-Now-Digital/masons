/**
 * Default column configurations for Orders and Invoices modules
 * These match the current hardcoded column layouts
 */

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultWidth: number;
}

// Orders column definitions (extracted from SortableOrdersTable)
export const ordersColumns: ColumnDefinition[] = [
  { id: 'id', label: 'Order ID', defaultWidth: 120 },
  { id: 'customer', label: 'Customer', defaultWidth: 180 },
  { id: 'deceasedName', label: 'Deceased', defaultWidth: 150 },
  { id: 'type', label: 'Type', defaultWidth: 150 },
  { id: 'stoneStatus', label: 'Stone Status', defaultWidth: 120 },
  { id: 'progress', label: 'Progress', defaultWidth: 80 },
  { id: 'depositDate', label: 'Deposit Date', defaultWidth: 120 },
  { id: 'installationDate', label: 'Installation Date', defaultWidth: 140 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 120 },
  { id: 'value', label: 'Value', defaultWidth: 100 },
  { id: 'messages', label: 'Messages', defaultWidth: 80 },
];

// Invoices column definitions (extracted from InvoicingPage)
export const invoicesColumns: ColumnDefinition[] = [
  { id: 'expand', label: '', defaultWidth: 50 },
  { id: 'invoiceNumber', label: 'Invoice Number', defaultWidth: 150 },
  { id: 'customer', label: 'Person', defaultWidth: 180 },
  { id: 'amount', label: 'Amount', defaultWidth: 120 },
   { id: 'paid', label: 'Paid', defaultWidth: 140 },
   { id: 'remaining', label: 'Remaining', defaultWidth: 150 },
  { id: 'status', label: 'Status', defaultWidth: 100 },
  { id: 'stripePaymentLink', label: 'Stripe payment link', defaultWidth: 140 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 120 },
  { id: 'paymentMethod', label: 'Payment Method', defaultWidth: 150 },
  { id: 'actions', label: 'Actions', defaultWidth: 120 },
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
 * Get default column visibility for a module (all visible by default)
 */
export function getDefaultColumnVisibility(module: 'orders' | 'invoices'): Record<string, boolean> {
  const columns = getColumnDefinitions(module);
  const visibility: Record<string, boolean> = {};
  columns.forEach(col => {
    visibility[col.id] = col.id === 'stripePaymentLink' ? false : true;
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

