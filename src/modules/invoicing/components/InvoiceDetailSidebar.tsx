import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { X, DollarSign, Calendar, FileText, Plus } from 'lucide-react';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';
import type { Invoice } from '../types/invoicing.types';
import { getOrderTotalFormatted } from '@/modules/orders/utils/orderCalculations';

interface InvoiceDetailSidebarProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export const InvoiceDetailSidebar: React.FC<InvoiceDetailSidebarProps> = ({ invoice, onClose }) => {
  const [createOrderDrawerOpen, setCreateOrderDrawerOpen] = useState(false);
  const { data: orders, isLoading: isOrdersLoading } = useOrdersByInvoice(invoice?.id ?? null);

  if (!invoice) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-700";
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "overdue": return "bg-red-100 text-red-700";
      case "draft": return "bg-gray-100 text-gray-700";
      case "cancelled": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Invoice Details</h2>
            <p className="text-sm text-muted-foreground">{invoice.invoice_number}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Invoice Information */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={getStatusColor(invoice.status)}>
                {invoice.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Customer</span>
              {invoice.customer_name && invoice.customer_name.trim() ? (
                <CustomerDetailsPopover
                  invoiceId={invoice.id}
                  fallbackName={invoice.customer_name}
                  fallbackPhone={null}
                  fallbackEmail={null}
                  trigger={
                    <button className="text-left hover:underline font-medium">
                      {invoice.customer_name}
                    </button>
                  }
                />
              ) : (
                <span className="font-medium text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(invoice.amount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Issue Date</span>
                  <span className="text-sm">{formatDate(invoice.issue_date)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <span className="text-sm">{formatDate(invoice.due_date)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        {invoice.payment_method || invoice.payment_date ? (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.payment_method && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Method</span>
                  <span className="text-sm">{invoice.payment_method}</span>
                </div>
              )}
              {invoice.payment_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Date</span>
                  <span className="text-sm">{formatDate(invoice.payment_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Notes */}
        {invoice.notes && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Orders Section */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Orders</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateOrderDrawerOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Order
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isOrdersLoading && (
              <p className="text-sm text-muted-foreground">Loading orders...</p>
            )}
            {!isOrdersLoading && (!orders || orders.length === 0) && (
              <p className="text-sm text-muted-foreground">No orders for this invoice</p>
            )}
            {!isOrdersLoading && orders && orders.length > 0 && (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.id} className="border rounded-md p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-sm text-muted-foreground">{order.order_type}</div>
                      </div>
                      <div className="text-sm font-medium">
                        {getOrderTotalFormatted(order)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Order Drawer */}
      <CreateOrderDrawer
        open={createOrderDrawerOpen}
        onOpenChange={setCreateOrderDrawerOpen}
        invoiceId={invoice.id}
      />
    </div>
  );
};

