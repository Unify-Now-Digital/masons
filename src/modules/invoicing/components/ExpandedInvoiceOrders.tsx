import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';
import { EditOrderDrawer } from '@/modules/orders/components/EditOrderDrawer';
import { DeleteOrderDialog } from '@/modules/orders/components/DeleteOrderDialog';
import type { Order } from '@/modules/orders/types/orders.types';
import { getOrderTotalFormatted, getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import { getOrderDisplayIdShort } from '@/modules/orders/utils/orderDisplayId';
import type { Invoice } from '../types/invoicing.types';
import type { CreateStripeInvoiceResponse } from '../api/stripe.api';
import { useUpdateInvoice } from '../hooks/useInvoices';
import { ensureStripeInvoice } from '../utils/ensureStripeInvoice';
import { formatDateDMY } from '@/shared/lib/formatters';
import { useOrganization } from '@/shared/context/OrganizationContext';

interface ExpandedInvoiceOrdersProps {
  invoiceId: string;
  /** When Stripe invoice is auto-created, call with (invoiceId, data) so parent can merge into selectedInvoice */
  onStripeInvoiceCreated?: (invoiceId: string, data: CreateStripeInvoiceResponse) => void;
}

/**
 * Recalculate and update invoice amount based on linked orders.
 * Returns the updated invoice or null on error.
 */
async function recalculateInvoiceAmount(
  invoiceId: string,
  orders: Order[],
  updateInvoice: (params: { id: string; updates: { amount: number } }) => Promise<Invoice>
): Promise<Invoice | null> {
  try {
    const newAmount = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const updated = await updateInvoice({ id: invoiceId, updates: { amount: newAmount } });
    return updated ?? null;
  } catch (error) {
    console.error('Failed to recalculate invoice amount:', error);
    return null;
  }
}

export const ExpandedInvoiceOrders: React.FC<ExpandedInvoiceOrdersProps> = ({
  invoiceId,
  onStripeInvoiceCreated,
}) => {
  const [createOrderDrawerOpen, setCreateOrderDrawerOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { data: orders, isLoading, isError, refetch: refetchOrders } = useOrdersByInvoice(invoiceId);
  const { mutateAsync: updateInvoiceAsync } = useUpdateInvoice();
  
  // Recalculate invoice amount when orders change; then ensure Stripe invoice exists if amount > 0
  const lastOrdersTotalRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!invoiceId || orders === undefined) return;
    const currentTotal = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    if (lastOrdersTotalRef.current !== null && currentTotal === lastOrdersTotalRef.current) return;

    lastOrdersTotalRef.current = currentTotal;
    (async () => {
      const updatedInvoice = await recalculateInvoiceAmount(invoiceId, orders, updateInvoiceAsync);
      if (currentTotal > 0 && updatedInvoice) {
        try {
          await ensureStripeInvoice(
            {
              id: updatedInvoice.id,
              amount: updatedInvoice.amount,
              stripe_invoice_id: updatedInvoice.stripe_invoice_id ?? null,
              hasOrders: orders.length > 0,
            },
            {
              queryClient,
              organizationId,
              onSuccess: (data) => onStripeInvoiceCreated?.(invoiceId, data),
            }
          );
        } catch {
          // Logged in ensureStripeInvoice; allow retry via Link
        }
      }
    })();
  }, [orders, invoiceId, updateInvoiceAsync, queryClient, onStripeInvoiceCreated, organizationId]);

  // Removed formatCurrency - using getOrderTotalFormatted instead for derived totals

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
            <div className="font-medium text-sm">{getOrderDisplayIdShort(order)}</div>
          </TableCell>
          <TableCell>
            <div className="font-medium">{order.customer_name}</div>
            <div className="text-xs text-muted-foreground">{order.order_type}</div>
          </TableCell>
          <TableCell className="font-medium">{getOrderTotalFormatted(order)}</TableCell>
          <TableCell>
            <Badge className={getStatusColor(order.stone_status)}>
              {order.stone_status}
            </Badge>
          </TableCell>
          <TableCell>{order.due_date ? formatDateDMY(order.due_date) : 'N/A'}</TableCell>
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
        onOpenChange={(open) => {
          setCreateOrderDrawerOpen(open);
          // Refetch orders when drawer closes (order may have been created)
          if (!open) {
            refetchOrders();
          }
        }}
        invoiceId={invoiceId}
      />
      {orderToEdit && (
        <EditOrderDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) {
              setOrderToEdit(null);
              // Refetch orders when drawer closes (order may have been updated)
              refetchOrders();
            }
          }}
          order={orderToEdit}
        />
      )}
      {orderToDelete && (
        <DeleteOrderDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setOrderToDelete(null);
              // Refetch orders when dialog closes (order may have been deleted)
              refetchOrders();
            }
          }}
          order={orderToDelete}
        />
      )}
    </>
  );
};

