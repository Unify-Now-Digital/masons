import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Search, Plus, Download, Send, Eye, AlertCircle, DollarSign, TrendingUp, Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useInvoicesList } from '../hooks/useInvoices';
import { transformInvoicesForUI, type UIInvoice } from '../utils/invoiceTransform';
import { CreateInvoiceDrawer } from '../components/CreateInvoiceDrawer';
import { EditInvoiceDrawer } from '../components/EditInvoiceDrawer';
import { DeleteInvoiceDialog } from '../components/DeleteInvoiceDialog';
import { InvoiceDetailSidebar } from '../components/InvoiceDetailSidebar';
import { ExpandedInvoiceOrders } from '../components/ExpandedInvoiceOrders';
import type { Invoice } from '../types/invoicing.types';

export const InvoicingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const { data: invoicesData, isLoading, error } = useInvoicesList();

  // Transform invoices from DB format to UI format
  const uiInvoices = useMemo(() => {
    if (!invoicesData) return [];
    return transformInvoicesForUI(invoicesData);
  }, [invoicesData]);

  const toggleInvoiceExpansion = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

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

  const filteredInvoices = useMemo(() => {
    if (!uiInvoices) return [];
    return uiInvoices.filter(invoice => {
      const matchesTab = activeTab === "all" || invoice.status === activeTab;
      const matchesSearch = searchQuery === "" || 
                           invoice.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [uiInvoices, activeTab, searchQuery]);

  const stats = useMemo(() => {
    if (!uiInvoices) {
      return { totalOutstanding: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0 };
    }
    
    const totalOutstanding = uiInvoices
      .filter(inv => inv.status !== "paid" && inv.status !== "cancelled")
      .reduce((sum, inv) => {
        const amount = parseFloat(inv.amount.replace('$', '').replace(/,/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    const totalPaid = uiInvoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => {
        const amount = parseFloat(inv.amount.replace('$', '').replace(/,/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    const overdueCount = uiInvoices.filter(inv => inv.status === "overdue").length;
    
    const totalAmount = uiInvoices.reduce((sum, inv) => {
      const amount = parseFloat(inv.amount.replace('$', '').replace(/,/g, ''));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

    return { totalOutstanding, totalPaid, overdueCount, collectionRate };
  }, [uiInvoices]);

  const handleEditInvoice = (invoice: UIInvoice) => {
    // Find the original DB invoice by ID
    const dbInvoice = invoicesData?.find((inv) => inv.id === invoice.id);
    if (dbInvoice) {
      setInvoiceToEdit(dbInvoice);
      setEditDrawerOpen(true);
    }
  };

  const handleDeleteInvoice = (invoice: UIInvoice) => {
    // Find the original DB invoice by ID
    const dbInvoice = invoicesData?.find((inv) => inv.id === invoice.id);
    if (dbInvoice) {
      setInvoiceToDelete(dbInvoice);
      setDeleteDialogOpen(true);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-red-600">
          Error loading invoices: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Invoicing</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage invoices and track payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${stats.totalOutstanding.toLocaleString()}</div>
                <p className="text-sm text-slate-600">Outstanding</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.overdueCount}</div>
                <p className="text-sm text-slate-600">Overdue Invoices</p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">${stats.totalPaid.toLocaleString()}</div>
                <p className="text-sm text-slate-600">Paid This Month</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.collectionRate}%</div>
                <p className="text-sm text-slate-600">Collection Rate</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Invoices</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-slate-600">Loading invoices...</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  {searchQuery ? 'No invoices match your search.' : 'No invoices found.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <React.Fragment key={invoice.id}>
                        <TableRow className="hover:bg-slate-50">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleInvoiceExpansion(invoice.id);
                              }}
                            >
                              {expandedInvoices.has(invoice.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{invoice.customer}</div>
                            {invoice.orderId && (
                              <div className="text-sm text-slate-500">Order: {invoice.orderId.substring(0, 8)}...</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{invoice.amount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(invoice.status)}>
                              {invoice.status}
                            </Badge>
                            {invoice.status === "overdue" && (
                              <span className="text-xs text-red-600">
                                {invoice.daysOverdue} days
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{invoice.dueDate}</TableCell>
                        <TableCell>{invoice.paymentMethod || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditInvoice(invoice)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteInvoice(invoice)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const dbInvoice = invoicesData?.find((inv) => inv.id === invoice.id);
                                if (dbInvoice) setSelectedInvoice(dbInvoice);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Send className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedInvoices.has(invoice.id) && (
                        <ExpandedInvoiceOrders invoiceId={invoice.id} />
                      )}
                    </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Drawer */}
      <CreateInvoiceDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {/* Edit Invoice Drawer */}
      {invoiceToEdit && (
        <EditInvoiceDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) setInvoiceToEdit(null);
          }}
          invoice={invoiceToEdit}
        />
      )}

      {/* Delete Invoice Dialog */}
      {invoiceToDelete && (
        <DeleteInvoiceDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setInvoiceToDelete(null);
          }}
          invoice={invoiceToDelete}
        />
      )}

      {/* Invoice Detail Sidebar */}
      <InvoiceDetailSidebar
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
};

export default InvoicingPage;
