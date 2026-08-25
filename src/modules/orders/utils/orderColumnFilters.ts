import type { UIOrder } from './orderTransform';
import { CUSTOMER_STAGES, ENQUIRY_STAGES } from './orderGrouping';
import { formatOrderTypeLabel } from './orderTypeDisplay';
import { STONE_STATUSES } from '../components/StoneStatusCell';
import { PERMIT_STATUSES } from '../components/PermitStatusCell';
import { PROOF_STATUSES } from '../components/ProofStatusCell';
import { formatStatusLabel } from '../components/orderColumnDefinitions';

export const FILTERABLE_COLUMN_IDS = [
  'customerType',
  'type',
  'stoneStatus',
  'material',
  'color',
  'permitStatus',
  'proofStatus',
] as const;
export type FilterableColumnId = (typeof FILTERABLE_COLUMN_IDS)[number];

export type ColumnFilters = Partial<Record<FilterableColumnId, string[]>>;

export interface FilterOption {
  value: string;
  label: string;
}

/** Chip headings; mirrors each column definition's `label`. */
export const FILTER_COLUMN_LABELS: Record<FilterableColumnId, string> = {
  customerType: 'Client',
  type: 'Type',
  stoneStatus: 'Stone',
  material: 'Stone Type',
  color: 'Stone Colour',
  permitStatus: 'Permit',
  proofStatus: 'Proof',
};

export const CLIENT_FILTER_LABELS = ['Customer', 'Invoiced', 'Enquiry', 'Unassigned'] as const;

/** Same authority as the Client badge (orderColumnDefinitions renderCell) — keep in lockstep. */
export function getClientLabel(order: UIOrder): string {
  const isCustomer = (CUSTOMER_STAGES as readonly string[]).includes(order.group);
  const isEnquiry = (ENQUIRY_STAGES as readonly string[]).includes(order.group);
  return isCustomer
    ? order.jobPaidAt !== null
      ? 'Customer'
      : 'Invoiced'
    : isEnquiry
      ? 'Enquiry'
      : 'Unassigned';
}

/** Raw value the predicate compares for a given filterable column. */
export function getFilterValue(order: UIOrder, columnId: FilterableColumnId): string {
  switch (columnId) {
    case 'customerType': return getClientLabel(order);
    case 'type': return order.type;
    case 'stoneStatus': return order.stoneStatus;
    case 'material': return order.material;
    case 'color': return order.color;
    case 'permitStatus': return order.permitStatus;
    case 'proofStatus': return order.proofStatus;
  }
}

/** OR within a column, AND across columns; empty/absent selection = no filter. */
export function matchesColumnFilters(order: UIOrder, filters: ColumnFilters): boolean {
  for (const columnId of FILTERABLE_COLUMN_IDS) {
    const selected = filters[columnId];
    if (!selected || selected.length === 0) continue;
    if (!selected.includes(getFilterValue(order, columnId))) return false;
  }
  return true;
}

// URL shape: f_<columnId>=v1,v2 — each value individually encodeURIComponent'd so
// literal commas in free-text values survive the join; '' (blank) is a legal value,
// distinguished by present-vs-absent param semantics ('f_material=' → ['']).
const FILTER_PARAM_PREFIX = 'f_';

export function filterParamName(columnId: FilterableColumnId): string {
  return `${FILTER_PARAM_PREFIX}${columnId}`;
}

export function parseColumnFilters(searchParams: URLSearchParams): ColumnFilters {
  const filters: ColumnFilters = {};
  for (const columnId of FILTERABLE_COLUMN_IDS) {
    const raw = searchParams.get(filterParamName(columnId));
    if (raw === null) continue;
    filters[columnId] = raw.split(',').map(decodeURIComponent);
  }
  return filters;
}

export function encodeFilterValues(values: string[]): string {
  return values.map(encodeURIComponent).join(',');
}

const BLANK_LABEL = '(blank)';

function distinctOptions(
  orders: UIOrder[],
  accessor: (o: UIOrder) => string,
  formatLabel?: (raw: string) => string,
): FilterOption[] {
  const values = new Set<string>();
  for (const order of orders) values.add(accessor(order));
  const options = [...values]
    .filter((v) => v !== '')
    .map((v) => ({ value: v, label: formatLabel ? formatLabel(v) : v }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (values.has('')) options.push({ value: '', label: BLANK_LABEL });
  return options;
}

/** Closed vocabularies list every value; free-text columns list distinct loaded values. */
export function buildFilterOptions(orders: UIOrder[]): Record<FilterableColumnId, FilterOption[]> {
  return {
    customerType: CLIENT_FILTER_LABELS.map((v) => ({ value: v, label: v })),
    type: distinctOptions(orders, (o) => o.type, formatOrderTypeLabel),
    stoneStatus: STONE_STATUSES.map((v) => ({ value: v, label: formatStatusLabel(v) })),
    material: distinctOptions(orders, (o) => o.material),
    color: distinctOptions(orders, (o) => o.color),
    permitStatus: PERMIT_STATUSES.map((v) => ({ value: v, label: formatStatusLabel(v) })),
    proofStatus: PROOF_STATUSES.map((v) => ({ value: v, label: formatStatusLabel(v) })),
  };
}
