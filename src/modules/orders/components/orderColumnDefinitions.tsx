import React from 'react';
import { TableCell } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical, AlertTriangle } from 'lucide-react';
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';
import { TestPill } from '@/shared/components/TestPill';
import { LeadSourcePill } from '@/shared/components/mason/LeadSourcePill';
import type { UIOrder } from '../utils/orderTransform';
import { CUSTOMER_STAGES, ENQUIRY_STAGES } from '../utils/orderGrouping';
import { getOrderDisplayIdShort } from '../utils/orderDisplayId';
import { formatOrderTypeLabel } from '../utils/orderTypeDisplay';
import { computeTimelineProgress, TIMELINE_BAR_TONE, weekCounterText } from '../utils/timelineProgress';
import { PaymentProgressBar } from '@/shared/components/PaymentProgressBar';
import { paidGapLabel } from '../utils/paidGapLabel';
import { StoneStatusCell } from './StoneStatusCell';
import type { ActionColour } from '@/shared/nextAction';
import { formatProofLabel } from '../utils/proofStatus';
import { OrderStatusChip as Chip } from './OrderStatusChip';

/** Permit chip: words + the shared next-action colours (green done, blue waiting on them, amber our move). */
const PERMIT_CHIP: Record<string, { label: string; colour: ActionColour }> = {
  not_started: { label: 'Not started', colour: 'amber' },
  form_sent: { label: 'Form with family', colour: 'blue' },
  customer_completed: { label: 'Signed · submit', colour: 'amber' },
  pending: { label: 'With cemetery', colour: 'blue' },
  approved: { label: 'Approved', colour: 'green' },
};
const PROOF_CHIP: Record<string, ActionColour> = {
  Not_Received: 'amber', Received: 'amber', In_Progress: 'amber', Revision: 'amber', Sent: 'blue', Approved: 'green', Lettered: 'green',
};
const gbp0 = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

import { ColumnFilterDropdown } from './ColumnFilterDropdown';

export interface OrderColumnDefinition {
  id: string;
  label: string;
  defaultWidth: number;
  sortable?: boolean;
  /** If set, this column stays visible on mobile (<md) regardless of user preferences. */
  mobilePriority?: 'primary';
  renderHeader: (props: {
    onSort?: () => void;
    sortDirection?: 'asc' | 'desc' | null;
    filter?: {
      options: { value: string; label: string }[];
      selected: string[];
      onChange: (values: string[]) => void;
    };
  }) => React.ReactNode;
  renderCell: (order: UIOrder, props?: {
    messageCount?: number;
    isLoadingCounts?: boolean;
    daysUntilDue?: number;
    /** Row clock, shared with daysUntilDue; the cell falls back to new Date() when absent. */
    now?: Date;
    productPhotoUrl?: string | null;
  }) => React.ReactNode;
}

type BadgeVariant = 'red' | 'amber' | 'green' | 'blue' | 'grey';

const getPermitVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'approved': return 'green';
    case 'pending': return 'amber';
    case 'form_sent': case 'customer_completed': return 'blue';
    default: return 'grey';
  }
};

const getPriorityIcon = (priority: string) => {
  if (priority === "high") return <AlertTriangle className="h-4 w-4 text-gardens-red" />;
  return null;
};

const getSortIcon = (sortDirection?: 'asc' | 'desc' | null) => {
  if (!sortDirection) return <ArrowUpDown className="h-4 w-4" />;
  return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
};

export const orderColumnDefinitions: OrderColumnDefinition[] = [
  {
    id: 'id',
    label: 'Ref',
    defaultWidth: 104,
    sortable: true,
    mobilePriority: 'primary',
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Ref
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {getPriorityIcon(order.priority)}
          <span className="text-[11px] font-semibold text-gardens-txm">{getOrderDisplayIdShort(order)}</span>
          <TestPill isTest={order.isTest} />
        </div>
      </TableCell>
    ),
  },
  {
    id: 'customer',
    label: 'Customer · deceased',
    defaultWidth: 210,
    sortable: true,
    mobilePriority: 'primary',
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Customer · deceased
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        {order.customer && order.customer !== '—' ? (
          <CustomerDetailsPopover
            personId={order.personId}
            fallbackName={order.customer}
            fallbackPhone={order.fallbackPhone}
            fallbackEmail={order.fallbackEmail}
            trigger={
              <button className="text-left hover:underline" onClick={(e) => e.stopPropagation()}>
                <div className="font-head text-[13px] font-semibold text-gardens-tx">{order.customer}</div>
                <div className="text-[11px] text-gardens-txs mt-0.5">
                  {order.deceasedName || '—'} · {order.type}
                </div>
                <div className="mt-1 flex"><LeadSourcePill source={order.leadSource} channel={order.leadChannel} /></div>
              </button>
            }
          />
        ) : (
          <span className="text-sm text-gardens-txm">—</span>
        )}
      </TableCell>
    ),
  },
  {
    id: 'nextStep',
    label: 'Next step',
    defaultWidth: 180,
    sortable: false,
    renderHeader: () => <span className="font-medium">Next step</span>,
    renderCell: () => <TableCell />,
  },
  {
    id: 'product',
    label: 'Product',
    defaultWidth: 220,
    sortable: false,
    renderHeader: () => <span className="font-medium">Product</span>,
    renderCell: () => <TableCell />,
  },
  {
    id: 'permit',
    label: 'Permit',
    defaultWidth: 140,
    sortable: false,
    renderHeader: () => <span className="font-medium">Permit</span>,
    renderCell: () => <TableCell />,
  },
  {
    id: 'proof',
    label: 'Proof',
    defaultWidth: 140,
    sortable: false,
    renderHeader: () => <span className="font-medium">Proof</span>,
    renderCell: () => <TableCell />,
  },
  {
    id: 'customerType',
    label: 'Client',
    defaultWidth: 110,
    sortable: false,
    renderHeader: ({ filter }) => (
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-gardens-txm" />
        <span className="font-medium">Client</span>
        {filter ? <ColumnFilterDropdown options={filter.options} selected={filter.selected} onChange={filter.onChange} /> : null}
      </div>
    ),
    renderCell: (order) => {
      // Stage-set membership from orderGrouping — same authority as the tab filter,
      // so badge and tab can never contradict (person.is_customer is deprecated here).
      // Green "Customer" implies paid; unpaid customers show grey "Invoiced".
      const isCustomer = (CUSTOMER_STAGES as readonly string[]).includes(order.group);
      const isEnquiry = (ENQUIRY_STAGES as readonly string[]).includes(order.group);
      return (
        <TableCell>
          <div className="flex items-center gap-1">
            <Badge variant={isCustomer && order.jobPaidAt !== null ? 'green' : 'grey'}>
              {isCustomer
                ? order.jobPaidAt !== null
                  ? 'Customer'
                  : 'Invoiced'
                : isEnquiry
                  ? 'Enquiry'
                  : 'Unassigned'}
            </Badge>
            {order.jobExitReason && <Badge variant="grey">Exited</Badge>}
          </div>
        </TableCell>
      );
    },
  },
  {
    id: 'deceasedName',
    label: 'Deceased',
    defaultWidth: 150,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Deceased
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <span className="text-sm text-gardens-tx">{order.deceasedName || '—'}</span>
      </TableCell>
    ),
  },
  {
    id: 'type',
    label: 'Type',
    defaultWidth: 150,
    sortable: true,
    renderHeader: ({ onSort, sortDirection, filter }) => (
      <>
        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
          <div className="flex items-center gap-2">
            <GripVertical className="h-3 w-3 text-gardens-txm" />
            Type
            {getSortIcon(sortDirection)}
          </div>
        </Button>
        {filter ? <ColumnFilterDropdown options={filter.options} selected={filter.selected} onChange={filter.onChange} /> : null}
      </>
    ),
    renderCell: (order) => (
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-gardens-tx">{formatOrderTypeLabel(order.type)}</span>
          {order.quoteId != null && order.quoteId !== '' ? (
            <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 h-5 shrink-0">
              From Quote
            </Badge>
          ) : null}
        </div>
      </TableCell>
    ),
  },
  {
    id: 'photo',
    label: 'Photo',
    defaultWidth: 60,
    sortable: false,
    renderHeader: () => (
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-gardens-txm" />
        <span className="font-medium">Photo</span>
      </div>
    ),
    renderCell: (order, { productPhotoUrl } = {}) => (
      <TableCell>
        {productPhotoUrl ? (
          <img
            src={productPhotoUrl}
            alt="Product"
            className="w-10 h-10 object-contain rounded border border-gardens-bdr"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="text-sm text-gardens-txm">—</span>
        )}
      </TableCell>
    ),
  },
  {
    id: 'stoneStatus',
    label: 'Stone',
    defaultWidth: 110,
    sortable: true,
    renderHeader: ({ onSort, sortDirection, filter }) => (
      <>
        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
          <div className="flex items-center gap-2">
            <GripVertical className="h-3 w-3 text-gardens-txm" />
            Stone
            {getSortIcon(sortDirection)}
          </div>
        </Button>
        {filter ? <ColumnFilterDropdown options={filter.options} selected={filter.selected} onChange={filter.onChange} /> : null}
      </>
    ),
    renderCell: (order) => (
      <TableCell>
        <StoneStatusCell order={order} />
      </TableCell>
    ),
  },
  {
    id: 'material',
    label: 'Stone Type',
    defaultWidth: 130,
    sortable: true,
    renderHeader: ({ onSort, sortDirection, filter }) => (
      <>
        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
          <div className="flex items-center gap-2">
            <GripVertical className="h-3 w-3 text-gardens-txm" />
            Stone Type
            {getSortIcon(sortDirection)}
          </div>
        </Button>
        {filter ? <ColumnFilterDropdown options={filter.options} selected={filter.selected} onChange={filter.onChange} /> : null}
      </>
    ),
    renderCell: (order) => (
      <TableCell>
        <span className="text-sm text-gardens-tx">{order.material || '—'}</span>
      </TableCell>
    ),
  },
  {
    id: 'color',
    label: 'Stone Colour',
    defaultWidth: 130,
    sortable: true,
    renderHeader: ({ onSort, sortDirection, filter }) => (
      <>
        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
          <div className="flex items-center gap-2">
            <GripVertical className="h-3 w-3 text-gardens-txm" />
            Stone Colour
            {getSortIcon(sortDirection)}
          </div>
        </Button>
        {filter ? <ColumnFilterDropdown options={filter.options} selected={filter.selected} onChange={filter.onChange} /> : null}
      </>
    ),
    renderCell: (order) => (
      <TableCell>
        <span className="text-sm text-gardens-tx">{order.color || '—'}</span>
      </TableCell>
    ),
  },
  {
    id: 'value',
    label: 'Value',
    defaultWidth: 90,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Value
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <span className="font-head text-[13px] font-semibold text-gardens-tx">{order.value}</span>
      </TableCell>
    ),
  },
  {
    id: 'progress',
    label: 'Progress',
    defaultWidth: 196,
    sortable: false,
    renderHeader: () => (
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-gardens-txm" />
        <span className="font-medium">Progress</span>
      </div>
    ),
    renderCell: (order, { now } = {}) => {
      const t = computeTimelineProgress(
        { depositDate: order.depositDate, timelineWeeks: order.timelineWeeks, installationDate: order.installationDate },
        now ?? new Date(),
      );
      const total = order.total || 0;
      const paid = order.amountPaid;
      // Deposit dated but no amount recorded (most SM orders today): show it as 'deposit in', hatched, never as £0.
      const paidPct = paid != null && total > 0 ? Math.max(0, Math.min(100, Math.round((paid / total) * 100))) : 0;
      const permit = PERMIT_CHIP[order.permitStatus] ?? null;
      const proof = order.proofStatus && order.proofStatus !== 'NA' ? order.proofStatus : null;
      return (
        <TableCell data-testid="order-progress">
          <div className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-x-2 gap-y-1 text-[11px] leading-4">
            <span className="text-gardens-txs">Timeline</span>
            {t.state === 'none'
              ? <span className="col-span-2 text-gardens-txm-aa">{t.label}</span>
              : <>
                  <PaymentProgressBar percent={t.percent} tone={t.isOver ? TIMELINE_BAR_TONE.over : TIMELINE_BAR_TONE.under} />
                  <span className={`tabular-nums ${weekCounterText(t).over ? 'font-semibold text-gardens-red-dk' : 'text-gardens-txs'}`}>{weekCounterText(t).text}</span>
                </>}
            {paid != null && (
              <>
                <span className="text-gardens-txs">Paid</span>
                <PaymentProgressBar percent={paidPct} tone={{ track: 'var(--g-bdr)', fill: paidPct >= 100 ? 'var(--g-na-green)' : 'var(--g-na-amber)' }} />
                <span className={`tabular-nums ${paid === 0 && order.depositDate ? 'font-semibold text-gardens-na-amber' : 'text-gardens-txs'}`} title={paid === 0 && order.depositDate ? 'Deposit received, amount not recorded' : undefined}>
                  {paid === 0 && order.depositDate ? paidGapLabel() : `${gbp0(paid)} / ${gbp0(total)}`}
                </span>
              </>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {permit ? <Chip k="Permit" v={permit.label} colour={permit.colour} /> : <Chip k="Permit" v="—" colour="grey" />}
            {proof ? <Chip k="Proof" v={formatProofLabel(proof)} colour={PROOF_CHIP[proof] ?? 'grey'} /> : <Chip k="Proof" v="—" colour="grey" />}
          </div>
        </TableCell>
      );
    },
  },
  {
    id: 'dueDate',
    label: 'Age',
    defaultWidth: 90,
    sortable: true,
    mobilePriority: 'primary',
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onSort?.(); }} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Age
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order, { daysUntilDue }) => (
      <TableCell>
        {daysUntilDue !== undefined && daysUntilDue !== Infinity ? (
          <span className={`text-[11px] font-semibold ${
            daysUntilDue < 0 ? 'text-gardens-red-dk' : daysUntilDue < 7 ? 'text-gardens-amb-dk' : 'text-gardens-txm'
          }`}>
            {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d`}
          </span>
        ) : (
          <span className="text-[11px] text-gardens-txm">—</span>
        )}
      </TableCell>
    ),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    defaultWidth: 140,
    sortable: false,
    renderHeader: () => (
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-gardens-txm" />
        <span className="font-medium">Timeline</span>
      </div>
    ),
    renderCell: (order, { now } = {}) => {
      const timeline = computeTimelineProgress(
        { depositDate: order.depositDate, timelineWeeks: order.timelineWeeks, installationDate: order.installationDate },
        now ?? new Date()
      );
      return (
        <TableCell>
          {timeline.state === 'none' ? (
            <span className="text-[11px] text-gardens-txm">{timeline.label}</span>
          ) : (
            <div className="space-y-1">
              <PaymentProgressBar
                percent={timeline.percent}
                tone={timeline.isOver ? TIMELINE_BAR_TONE.over : TIMELINE_BAR_TONE.under}
              />
              <span className={`text-[11px] font-semibold ${timeline.isOver ? 'text-gardens-red-dk' : 'text-gardens-txm'}`}>
                {timeline.label}
              </span>
            </div>
          )}
        </TableCell>
      );
    },
  },
  {
    id: 'messages',
    label: 'Msgs',
    defaultWidth: 70,
    sortable: false,
    renderHeader: () => (
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-gardens-txm" />
        Msgs
      </div>
    ),
    renderCell: (order, { messageCount, isLoadingCounts }) => (
      <TableCell>
        {isLoadingCounts ? (
          <span className="text-xs text-gardens-txm">-</span>
        ) : messageCount ? (
          <Badge variant="grey" className="text-[10px]">
            {messageCount}
          </Badge>
        ) : (
          <span className="text-xs text-gardens-txm">0</span>
        )}
      </TableCell>
    ),
  },
];
