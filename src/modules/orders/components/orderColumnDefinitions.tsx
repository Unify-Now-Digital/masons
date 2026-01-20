import React from 'react';
import { TableCell } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical, AlertTriangle } from 'lucide-react';
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';
import type { UIOrder } from '../utils/orderTransform';
import { getOrderDisplayIdShort } from '../utils/orderDisplayId';

export interface OrderColumnDefinition {
  id: string;
  label: string;
  defaultWidth: number;
  sortable?: boolean;
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

const getStatusColor = (status: string) => {
  switch (status) {
    case "NA": return "bg-gray-100 text-gray-700";
    case "Ordered": return "bg-blue-100 text-blue-700";
    case "In Stock": return "bg-green-100 text-green-700";
    case "form_sent": return "bg-yellow-100 text-yellow-700";
    case "customer_completed": return "bg-blue-100 text-blue-700";
    case "pending": return "bg-orange-100 text-orange-700";
    case "approved": return "bg-green-100 text-green-700";
    case "Not_Received": return "bg-red-100 text-red-700";
    case "Received": return "bg-blue-100 text-blue-700";
    case "In_Progress": return "bg-yellow-100 text-yellow-700";
    case "Lettered": return "bg-green-100 text-green-700";
    default: return "bg-gray-100 text-gray-700";
  }
};

const getPriorityIcon = (priority: string) => {
  if (priority === "high") return <AlertTriangle className="h-4 w-4 text-red-500" />;
  return null;
};

const getSortIcon = (sortDirection?: 'asc' | 'desc' | null) => {
  if (!sortDirection) {
    return <ArrowUpDown className="h-4 w-4" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="h-4 w-4" /> : 
    <ArrowDown className="h-4 w-4" />;
};

export const orderColumnDefinitions: OrderColumnDefinition[] = [
  {
    id: 'id',
    label: 'Order ID',
    defaultWidth: 120,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Order ID
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {getPriorityIcon(order.priority)}
          {getOrderDisplayIdShort(order)}
        </div>
      </TableCell>
    ),
  },
  {
    id: 'customer',
    label: 'Customer',
    defaultWidth: 180,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
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
              <button className="text-left hover:underline text-sm font-medium">
                {order.customer}
              </button>
            }
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
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
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Deceased
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <span className="text-sm">{order.deceasedName || '—'}</span>
      </TableCell>
    ),
  },
  {
    id: 'type',
    label: 'Type',
    defaultWidth: 150,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Type
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>{order.type}</TableCell>
    ),
  },
  {
    id: 'photo',
    label: 'Photo',
    defaultWidth: 60,
    sortable: false,
    renderHeader: () => (
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-slate-400" />
        <span className="font-medium">Photo</span>
      </div>
    ),
    renderCell: (order) => (
      <TableCell>
        {order.type === 'New Memorial' && order.productPhotoUrl ? (
          <img
            src={order.productPhotoUrl}
            alt="Product"
            className="w-10 h-10 object-cover rounded border"
            onError={(e) => {
              // Fallback to placeholder on error
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.textContent?.includes('—')) {
                parent.appendChild(document.createTextNode('—'));
              }
            }}
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
    ),
  },
  {
    id: 'stoneStatus',
    label: 'Stone Status',
    defaultWidth: 120,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Stone Status
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <Badge className={getStatusColor(order.stoneStatus)}>
          {order.stoneStatus.replace('_', ' ')}
        </Badge>
      </TableCell>
    ),
  },
  {
    id: 'progress',
    label: 'Progress',
    defaultWidth: 80,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Progress
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${order.progress}%` }}
            ></div>
          </div>
          <span className="text-xs text-slate-600">{order.progress}%</span>
        </div>
      </TableCell>
    ),
  },
  {
    id: 'depositDate',
    label: 'Deposit Date',
    defaultWidth: 120,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Deposit Date
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>{order.depositDate}</TableCell>
    ),
  },
  {
    id: 'installationDate',
    label: 'Installation Date',
    defaultWidth: 140,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Installation Date
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>
        <div className="text-sm">
          {order.installationDate || (
            <span className="text-slate-400 italic">Not scheduled</span>
          )}
        </div>
      </TableCell>
    ),
  },
  {
    id: 'dueDate',
    label: 'Due Date',
    defaultWidth: 120,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Due Date
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order, { daysUntilDue }) => (
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm">{order.dueDate}</span>
          {daysUntilDue !== undefined && (
            <span className={`text-xs ${daysUntilDue < 0 ? 'text-red-600' : daysUntilDue < 7 ? 'text-yellow-600' : 'text-slate-600'}`}>
              {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days left`}
            </span>
          )}
        </div>
      </TableCell>
    ),
  },
  {
    id: 'value',
    label: 'Total', // Updated: now shows base value + permit cost + additional options
    defaultWidth: 100,
    sortable: true,
    renderHeader: ({ onSort, sortDirection }) => (
      <Button
        variant="ghost"
        onClick={onSort}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-slate-400" />
          Total
          {getSortIcon(sortDirection)}
        </div>
      </Button>
    ),
    renderCell: (order) => (
      <TableCell>{order.value}</TableCell> // Displays formatted total (base + permit cost + additional options) via orderTransform
    ),
  },
  {
    id: 'messages',
    label: 'Messages',
    defaultWidth: 80,
    sortable: false,
    renderHeader: () => (
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-slate-400" />
        Messages
      </div>
    ),
    renderCell: (order, { messageCount, isLoadingCounts }) => (
      <TableCell>
        {isLoadingCounts ? (
          <span className="text-xs text-slate-400">-</span>
        ) : (
          <Badge variant="outline" className="text-xs">
            {messageCount || 0} {(messageCount || 0) === 1 ? 'message' : 'messages'}
          </Badge>
        )}
      </TableCell>
    ),
  },
];

