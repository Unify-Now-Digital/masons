import React from 'react';
import { TableCell } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical, AlertTriangle } from 'lucide-react';
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';
import type { UIOrder } from '../utils/orderTransform';
import { getOrderDisplayIdShort } from '../utils/orderDisplayId';
import { formatOrderTypeLabel, isNewMemorialOrderType } from '../utils/orderTypeDisplay';

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
  }) => React.ReactNode;
  renderCell: (order: UIOrder, props?: {
    messageCount?: number;
    isLoadingCounts?: boolean;
    daysUntilDue?: number;
  }) => React.ReactNode;
}

type BadgeVariant = 'red' | 'amber' | 'green' | 'blue' | 'grey';

const getStoneVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'In Stock': return 'green';
    case 'Ordered': return 'blue';
    default: return 'grey';
  }
};

const getPermitVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'approved': return 'green';
    case 'pending': return 'amber';
    case 'form_sent': case 'customer_completed': return 'blue';
    default: return 'grey';
  }
};

const getProofVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'Lettered': return 'green';
    case 'In_Progress': return 'amber';
    case 'Received': return 'blue';
    case 'Not_Received': return 'red';
    default: return 'grey';
  }
};

const formatStatusLabel = (status: string): string => {
  switch (status) {
    case 'form_sent': return 'Form sent';
    case 'customer_completed': return 'Customer done';
    case 'Not_Received': return 'Not received';
    case 'In_Progress': return 'In progress';
    case 'In Stock': return 'In stock';
    default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
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
    defaultWidth: 100,
    sortable: true,
    mobilePriority: 'primary',
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
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
        </div>
      </TableCell>
    ),
  },
  {
    id: 'customer',
    label: 'Customer',
    defaultWidth: 200,
    sortable: true,
    mobilePriority: 'primary',
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Customer
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
              <button className="text-left hover:underline">
                <div className="font-head text-[13px] font-semibold text-gardens-tx">{order.customer}</div>
                <div className="text-[11px] text-gardens-txs mt-0.5">
                  {order.deceasedName || '—'} · {order.type}
                </div>
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
    id: 'deceasedName',
    label: 'Deceased',
    defaultWidth: 150,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
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
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Type
          {getSortIcon(sortDirection)}
        </div>
      </Button>
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
    renderCell: (order) => (
      <TableCell>
        {isNewMemorialOrderType(order.type) && order.productPhotoUrl ? (
          <img
            src={order.productPhotoUrl}
            alt="Product"
            className="w-10 h-10 object-cover rounded border border-gardens-bdr"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.textContent?.includes('—')) {
                parent.appendChild(document.createTextNode('—'));
              }
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
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Stone
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <Badge variant={getStoneVariant(order.stoneStatus)}>
          {formatStatusLabel(order.stoneStatus)}
        </Badge>
      </TableCell>
    ),
  },
  {
    id: 'permitStatus',
    label: 'Permit',
    defaultWidth: 110,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Permit
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <Badge variant={getPermitVariant(order.permitStatus)}>
          {formatStatusLabel(order.permitStatus)}
        </Badge>
      </TableCell>
    ),
  },
  {
    id: 'proofStatus',
    label: 'Proof',
    defaultWidth: 110,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-gardens-txm" />
          Proof
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <Badge variant={getProofVariant(order.proofStatus)}>
          {formatStatusLabel(order.proofStatus)}
        </Badge>
      </TableCell>
    ),
  },
  {
    id: 'value',
    label: 'Value',
    defaultWidth: 90,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
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
    id: 'dueDate',
    label: 'Age',
    defaultWidth: 90,
    sortable: true,
    mobilePriority: 'primary',
    renderHeader: ({ onSort, sortDirection }) => (
      <Button variant="ghost" onClick={onSort} className="h-auto p-0 font-medium hover:bg-transparent">
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
