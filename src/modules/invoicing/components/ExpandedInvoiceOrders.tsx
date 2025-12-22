import React, { useState } from 'react';
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';
import { EditOrderDrawer } from '@/modules/orders/components/EditOrderDrawer';
import { DeleteOrderDialog } from '@/modules/orders/components/DeleteOrderDialog';
import type { Order } from '@/modules/orders/types/orders.types';

interface ExpandedInvoiceOrdersProps {
  invoiceId: string;
}

export const ExpandedInvoiceOrders: React.FC<ExpandedInvoiceOrdersProps> = ({ invoiceId }) => {
  const [createOrderDrawerOpen, setCreateOrderDrawerOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { data: orders, isLoading, isError } = useOrdersByInvoice(invoiceId);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NA": return "bg-gray-100 text-gray-700";
      case "Ordered": return "bg-blue-100 text-blue-700";
      case "In Stock": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={8} className="p-4 text-center text-sm text-muted-foreground bg-slate-50">
          Loading orders...
        </TableCell>
      </TableRow>
    );
  }

  if (isError) {
    return (
      <TableRow>
        <TableCell colSpan={8} className="p-4 text-center text-sm text-red-600 bg-slate-50">
          Unable to load orders
        </TableCell>
      </TableRow>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <>
        <TableRow>
          <TableCell colSpan={8} className="p-4 text-center bg-slate-50">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No orders yet. Click 'Add Order' to create one.</p>
              <Button
                size="sm"
                onClick={() => setCreateOrderDrawerOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Order
              </Button>
            </div>
          </TableCell>
        </TableRow>
        <CreateOrderDrawer
          open={createOrderDrawerOpen}
          onOpenChange={setCreateOrderDrawerOpen}
          invoiceId={invoiceId}
        />
      </>
    );
  }

  return (
    <>
      {orders.map((order) => (
        <TableRow key={order.id} className="bg-slate-50 hover:bg-slate-100">
          <TableCell className="pl-12 border-l-2 border-blue-200"></TableCell>
          <TableCell className="pl-4">
            <div className="font-medium text-sm">{order.id.substring(0, 8)}...</div>
          </TableCell>
          <TableCell>
            <div className="font-medium">{order.customer_name}</div>
            <div className="text-xs text-muted-foreground">{order.order_type}</div>
          </TableCell>
          <TableCell className="font-medium">{formatCurrency(order.value)}</TableCell>
          <TableCell>
            <Badge className={getStatusColor(order.stone_status)}>
              {order.stone_status}
            </Badge>
          </TableCell>
          <TableCell>{order.due_date ? new Date(order.due_date).toLocaleDateString() : 'N/A'}</TableCell>
          <TableCell></TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOrderToEdit(order);
                  setEditDrawerOpen(true);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  setOrderToDelete(order);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell colSpan={8} className="p-2 bg-slate-50">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOrderDrawerOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Order
          </Button>
        </TableCell>
      </TableRow>
      <CreateOrderDrawer
        open={createOrderDrawerOpen}
        onOpenChange={setCreateOrderDrawerOpen}
        invoiceId={invoiceId}
      />
      {orderToEdit && (
        <EditOrderDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) setOrderToEdit(null);
          }}
          order={orderToEdit}
        />
      )}
      {orderToDelete && (
        <DeleteOrderDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setOrderToDelete(null);
          }}
          order={orderToDelete}
        />
      )}
    </>
  );
};

