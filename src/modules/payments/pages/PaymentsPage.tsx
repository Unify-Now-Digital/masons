import React, { useMemo, useState } from 'react';
import { usePaymentsList } from '../hooks/usePayments';
import { transformPaymentsFromDb } from '../utils/paymentTransform';
import { CreatePaymentDrawer } from '../components/CreatePaymentDrawer';
import { EditPaymentDrawer } from '../components/EditPaymentDrawer';
import { DeletePaymentDialog } from '../components/DeletePaymentDialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import type { Payment } from '../hooks/usePayments';
import type { UIPayment } from '../utils/paymentTransform';
import { useInvoicesList } from '@/modules/invoicing/hooks/useInvoices';

const methodColors: Record<string, string> = {
  cash: 'bg-green-500',
  card: 'bg-blue-500',
  bank_transfer: 'bg-purple-500',
  check: 'bg-yellow-500',
  online: 'bg-indigo-500',
  other: 'bg-gray-500',
};

const formatMethod = (method: string) => {
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
};

interface EnhancedPayment extends UIPayment {
  invoiceNumber: string | null;
  customerName: string | null;
}

export const PaymentsPage: React.FC = () => {
  const { data: paymentsData, isLoading, error, refetch } = usePaymentsList();
  const { data: invoicesData } = useInvoicesList();
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const payments = useMemo(() => {
    if (!paymentsData) return [];
    return transformPaymentsFromDb(paymentsData);
  }, [paymentsData]);

  // Create a map of invoice IDs to invoice data for quick lookup
  const invoiceMap = useMemo(() => {
    if (!invoicesData) return new Map();
    return new Map(invoicesData.map((inv) => [inv.id, inv]));
  }, [invoicesData]);

  // Enhance payments with invoice data
  const enhancedPayments = useMemo<EnhancedPayment[]>(() => {
    return payments.map((payment) => {
      const invoice = invoiceMap.get(payment.invoiceId);
      return {
        ...payment,
        invoiceNumber: invoice?.invoice_number || null,
        customerName: invoice?.customer_name || null,
      };
    });
  }, [payments, invoiceMap]);

  const filteredPayments = useMemo(() => {
    if (!enhancedPayments) return [];
    
    let filtered = enhancedPayments;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(query)) ||
          (p.customerName && p.customerName.toLowerCase().includes(query)) ||
          (p.reference && p.reference.toLowerCase().includes(query)) ||
          (p.notes && p.notes.toLowerCase().includes(query))
      );
    }
    
    // Method filter
    if (methodFilter !== 'all') {
      filtered = filtered.filter((p) => p.method === methodFilter);
    }
    
    return filtered;
  }, [enhancedPayments, searchQuery, methodFilter]);

  const handleEdit = (payment: UIPayment) => {
    const dbPayment = paymentsData?.find((p) => p.id === payment.id);
    if (dbPayment) {
      setSelectedPayment(dbPayment);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (payment: UIPayment) => {
    const dbPayment = paymentsData?.find((p) => p.id === payment.id);
    if (dbPayment) {
      setSelectedPayment(dbPayment);
      setDeleteDialogOpen(true);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">Error loading payments</p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">
            Manage payment records for invoices
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Payment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>View and manage all payment records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search by invoice number, customer, reference, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || methodFilter !== 'all'
                  ? 'No payments match your filters'
                  : 'No payments found'}
              </p>
              {!searchQuery && methodFilter === 'all' && (
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Payment
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {(() => {
                        try {
                          const date = new Date(payment.date);
                          if (isNaN(date.getTime())) {
                            return 'Invalid date';
                          }
                          return format(date, 'MMM dd, yyyy');
                        } catch {
                          return 'Invalid date';
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {payment.invoiceNumber || (
                        <span className="text-muted-foreground text-sm">
                          {payment.invoiceId.substring(0, 8)}...
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.customerName || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={methodColors[payment.method] || 'bg-gray-500'}
                      >
                        {formatMethod(payment.method)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.reference || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {payment.notes || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(payment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(payment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreatePaymentDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {selectedPayment && (
        <>
          <EditPaymentDrawer
            open={editDrawerOpen}
            onOpenChange={(open) => {
              setEditDrawerOpen(open);
              if (!open) setSelectedPayment(null);
            }}
            payment={selectedPayment}
          />

          <DeletePaymentDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedPayment(null);
            }}
            payment={selectedPayment}
          />
        </>
      )}
    </div>
  );
};

