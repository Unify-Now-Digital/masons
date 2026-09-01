import React, { useMemo } from 'react';
import { Card, CardContent } from "@/shared/components/ui/card";
import { AlertCircle, DollarSign, TrendingUp } from 'lucide-react';
import { useInvoicesList } from '../hooks/useInvoices';
import { transformInvoicesForUI } from '../utils/invoiceTransform';
import { InvoiceWorkspace } from '../components/InvoiceWorkspace';
import { formatGbpDecimal } from '@/shared/lib/formatters';

export const InvoicingPage: React.FC = () => {
  const { data: invoicesData } = useInvoicesList();

  // Transform invoices from DB format to UI format
  const uiInvoices = useMemo(() => {
    if (!invoicesData) return [];
    return transformInvoicesForUI(invoicesData);
  }, [invoicesData]);

  const stats = useMemo(() => {
    if (!uiInvoices) {
      return { totalOutstanding: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0 };
    }

    const totalOutstanding = uiInvoices
      .filter(inv => inv.status !== "paid" && inv.status !== "cancelled")
      .reduce((sum, inv) => {
        const amount = parseFloat(inv.amount.replace(/[^0-9.]/g, '').replace(/,/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    const totalPaid = uiInvoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => {
        const amount = parseFloat(inv.amount.replace(/[^0-9.]/g, '').replace(/,/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    const overdueCount = uiInvoices.filter(inv => inv.status === "overdue").length;

    const totalAmount = uiInvoices.reduce((sum, inv) => {
      const amount = parseFloat(inv.amount.replace(/[^0-9.]/g, '').replace(/,/g, ''));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

    return { totalOutstanding, totalPaid, overdueCount, collectionRate };
  }, [uiInvoices]);

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Invoicing</h1>
        <p className="text-sm text-gardens-tx mt-1">
          Manage invoices and track payments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatGbpDecimal(stats.totalOutstanding)}</div>
                <p className="text-sm text-gardens-tx">Outstanding</p>
              </div>
              <div className="h-8 w-8 bg-gardens-amb-lt rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-gardens-amb-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gardens-red-dk">{stats.overdueCount}</div>
                <p className="text-sm text-gardens-tx">Overdue Invoices</p>
              </div>
              <div className="h-8 w-8 bg-gardens-red-lt rounded-full flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-gardens-red-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gardens-grn-dk">{formatGbpDecimal(stats.totalPaid)}</div>
                <p className="text-sm text-gardens-tx">Paid This Month</p>
              </div>
              <div className="h-8 w-8 bg-gardens-grn-lt rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-gardens-grn-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.collectionRate}%</div>
                <p className="text-sm text-gardens-tx">Collection Rate</p>
              </div>
              <div className="h-8 w-8 bg-gardens-blu-lt rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-gardens-blu-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legacy render site (unrouted; deleted in C5) — C4b props stubbed like C2's patch. */}
      <InvoiceWorkspace
        invoices={invoicesData ?? []}
        activeTile="all"
        tiles={{ items: [], allZero: false }}
        onActiveTileChange={() => {}}
        showVoidedInvoices={false}
        onShowVoidedInvoicesChange={() => {}}
      />
    </div>
  );
};

export default InvoicingPage;
