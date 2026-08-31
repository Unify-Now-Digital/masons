import React, { useState, useEffect, useRef } from 'react';
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
import { useInvoice, useUpdateInvoice } from '../hooks/useInvoices';
import { formatDateDMY } from '@/shared/lib/formatters';

interface ExpandedInvoiceOrdersProps {
  invoiceId: string;
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

export const ExpandedInvoiceOrders: React.FC<ExpandedInvoiceOrdersProps> = ({ invoiceId }) => {
  const [createOrderDrawerOpen, setCreateOrderDrawerOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { data: orders, isLoading, isError, refetch: refetchOrders } = useOrdersByInvoice(invoiceId);
  const { mutateAsync: updateInvoiceAsync } = useUpdateInvoice();
  // Stored amount for the value-identical-write guard; read-only, org-scoped detail
  // query whose cache useUpdateInvoice.onSuccess keeps fresh (useInvoices.ts:89).
  const { data: currentInvoice } = useInvoice(invoiceId);
  
  // Recalculate invoice amount when orders change. Stripe creation is deferred to the
  // explicit buttons (sidebar "Create Stripe invoice" / table "Link") — never automatic.
  const lastOrdersTotalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!invoiceId || orders === undefined) return;
    // Orders are NOT the source of truth for an invoice with none linked (e.g. portal
    // INV-WEB-* rows carry quote-derived amounts) — recalculating from an empty set
    // zeroed live amounts. Mirrors EditInvoiceDrawer's calculatedAmount fallback.
    if (orders.length === 0) return;
    if (currentInvoice === undefined) return;
    const currentTotal = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    if (lastOrdersTotalRef.current !== null && currentTotal === lastOrdersTotalRef.current) return;

    lastOrdersTotalRef.current = currentTotal;
    // invoices.amount is decimal(10,2) — compare in integer pence: a write can never
    // store more precision than 2dp, so sub-pence float noise must not trigger one.
    // Value-identical writes to live money rows are skipped.
    if (Math.round(currentTotal * 100) === Math.round(Number(currentInvoice.amount) * 100)) return;
    void recalculateInvoiceAmount(invoiceId, orders, updateInvoiceAsync);
  }, [orders, invoiceId, currentInvoice, updateInvoiceAsync]);

  // Removed formatCurrency - using getOrderTotalFormatted instead for derived totals

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NA": return "bg-gardens-page text-gardens-tx";
      case "Ordered": return "bg-gardens-blu-lt text-gardens-blu-dk";
      case "In Stock": return "bg-gardens-grn-lt text-gardens-grn-dk";
      default: return "bg-gardens-page text-gardens-tx";
    }
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={8} className="p-4 text-center text-sm text-muted-foreground bg-gardens-page">
          Loading orders...
        </TableCell>
      </TableRow>
    );
  }

  if (isError) {
    return (
      <TableRow>
        <TableCell colSpan={8} className="p-4 text-center text-sm text-gardens-red-dk bg-gardens-page">
          Unable to load orders
        </TableCell>
      </TableRow>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <>
        <TableRow>
          <TableCell colSpan={8} className="p-4 text-center bg-gardens-page">
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
        <TableRow key={order.id} className="bg-gardens-page hover:bg-gardens-page">
          <TableCell className="pl-12 border-l-2 border-gardens-blu-lt"></TableCell>
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
                className="text-gardens-red-dk hover:text-gardens-red-dk hover:bg-gardens-red-lt"
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
        <TableCell colSpan={8} className="p-2 bg-gardens-page">
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

