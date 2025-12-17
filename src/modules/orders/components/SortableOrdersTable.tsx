import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { useMessageCountsByOrders } from '@/modules/inbox/hooks/useMessages';

interface Order {
  id: string;
  customer: string;
  type: string;
  stoneStatus: string;
  permitStatus: string;
  proofStatus: string;
  dueDate: string;
  depositDate: string;
  secondPaymentDate: string | null;
  installationDate: string | null;
  value: string;
  location: string;
  progress: number;
  assignedTo: string;
  priority: string;
  sku: string;
  material: string;
  color: string;
  timelineWeeks: number;
}

interface SortConfig {
  key: keyof Order;
  direction: 'asc' | 'desc';
}

interface SortableOrdersTableProps {
  orders: Order[];
  onOrderUpdate?: (orderId: string, updates: Partial<Order>) => void;
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onDeleteOrder?: (order: Order) => void;
}

export const SortableOrdersTable: React.FC<SortableOrdersTableProps> = ({ orders, onOrderUpdate, onViewOrder, onEditOrder, onDeleteOrder }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnOrder] = useState([
    'id', 'customer', 'type', 'stoneStatus', 'progress', 'depositDate', 'installationDate', 'dueDate', 'value', 'messages'
  ]);

  // Extract order IDs for batch fetching
  const orderIds = React.useMemo(() => orders.map(order => order.id), [orders]);
  
  // Batch fetch message counts for all orders
  const { data: messageCounts, isLoading: isLoadingCounts } = useMessageCountsByOrders(orderIds);
  
  // Create lookup map for O(1) access
  const messageCountMap = React.useMemo(() => {
    return messageCounts || {};
  }, [messageCounts]);

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

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return Infinity;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSort = (key: keyof Order) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: keyof Order) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const sortedOrders = React.useMemo(() => {
    if (!sortConfig) return orders;

    return [...orders].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (sortConfig.key === 'progress') {
        return sortConfig.direction === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }

      if (sortConfig.key === 'dueDate' || sortConfig.key === 'depositDate' || sortConfig.key === 'installationDate') {
        const aDate = new Date(aValue as string);
        const bDate = new Date(bValue as string);
        return sortConfig.direction === 'asc' 
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [orders, sortConfig]);

  const getColumnTitle = (key: string) => {
    const titles: Record<string, string> = {
      id: 'Order ID',
      customer: 'Customer',
      type: 'Type',
      stoneStatus: 'Stone Status',
      progress: 'Progress',
      depositDate: 'Deposit Date',
      installationDate: 'Installation Date',
      dueDate: 'Due Date',
      value: 'Value',
      messages: 'Messages'
    };
    return titles[key] || key;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columnOrder.map((columnKey) => (
              <TableHead key={columnKey} className="relative">
                {columnKey === 'messages' ? (
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3 w-3 text-slate-400" />
                    {getColumnTitle(columnKey)}
                    {/* No sort icon for messages column */}
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => handleSort(columnKey as keyof Order)}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3 w-3 text-slate-400" />
                      {getColumnTitle(columnKey)}
                      {getSortIcon(columnKey as keyof Order)}
                    </div>
                  </Button>
                )}
              </TableHead>
            ))}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.map((order) => {
            const daysUntilDue = getDaysUntilDue(order.dueDate);
            return (
              <TableRow key={order.id} className="hover:bg-slate-50">
                {columnOrder.map((columnKey) => {
                  switch (columnKey) {
                    case 'messages': {
                      const count = messageCountMap[order.id] || 0;
                      return (
                        <TableCell key={columnKey}>
                          {isLoadingCounts ? (
                            <span className="text-xs text-slate-400">-</span>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {count} {count === 1 ? 'message' : 'messages'}
                            </Badge>
                          )}
                        </TableCell>
                      );
                    }
                    case 'id':
                      return (
                        <TableCell key={columnKey} className="font-medium">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(order.priority)}
                            {order.id}
                          </div>
                        </TableCell>
                      );
                    case 'stoneStatus':
                      return (
                        <TableCell key={columnKey}>
                          <Badge className={getStatusColor(order.stoneStatus)}>
                            {order.stoneStatus.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      );
                    case 'progress':
                      return (
                        <TableCell key={columnKey}>
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
                      );
                    case 'installationDate':
                      return (
                        <TableCell key={columnKey}>
                          <div className="text-sm">
                            {order.installationDate || (
                              <span className="text-slate-400 italic">Not scheduled</span>
                            )}
                          </div>
                        </TableCell>
                      );
                    case 'dueDate':
                      return (
                        <TableCell key={columnKey}>
                          <div className="flex flex-col">
                            <span className="text-sm">{order.dueDate}</span>
                            <span className={`text-xs ${daysUntilDue < 0 ? 'text-red-600' : daysUntilDue < 7 ? 'text-yellow-600' : 'text-slate-600'}`}>
                              {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days left`}
                            </span>
                          </div>
                        </TableCell>
                      );
                    default:
                      return (
                        <TableCell key={columnKey}>
                          {order[columnKey as keyof Order]}
                        </TableCell>
                      );
                  }
                })}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {onViewOrder && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onViewOrder(order)}
                      >
                        View
                      </Button>
                    )}
                    {onEditOrder && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onEditOrder(order)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteOrder && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onDeleteOrder(order)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default SortableOrdersTable;

