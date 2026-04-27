import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Search, Plus, Users, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { useCustomersList, type Customer } from "../hooks/useCustomers";
import { transformCustomersFromDb, type UICustomer } from "../utils/customerTransform";
import { CreateCustomerDrawer } from "../components/CreateCustomerDrawer";
import { EditCustomerDrawer } from "../components/EditCustomerDrawer";
import { DeleteCustomerDialog } from "../components/DeleteCustomerDialog";
import { formatDateDMY } from "@/shared/lib/formatters";

export const CustomersPage: React.FC = () => {
  const { data: customersData, isLoading, error, refetch } = useCustomersList();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Deep-link: ?customer=<id> → open the edit drawer for that customer.
  useEffect(() => {
    const customerId = searchParams.get('customer');
    if (!customerId || editDrawerOpen || !customersData) return;
    const match = customersData.find((c) => c.id === customerId);
    if (match) {
      setCustomerToEdit(match);
      setEditDrawerOpen(true);
    }
  }, [searchParams, editDrawerOpen, customersData]);

  const uiCustomers = useMemo<UICustomer[]>(() => {
    if (!customersData) return [];
    return transformCustomersFromDb(customersData);
  }, [customersData]);

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return uiCustomers;
    return uiCustomers.filter((customer) => {
      return (
        customer.firstName.toLowerCase().includes(query) ||
        customer.lastName.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
      );
    });
  }, [uiCustomers, searchQuery]);

  const handleEdit = (customerId: string) => {
    const dbCustomer = customersData?.find((c) => c.id === customerId);
    if (dbCustomer) {
      setCustomerToEdit(dbCustomer);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (customerId: string) => {
    const dbCustomer = customersData?.find((c) => c.id === customerId);
    if (dbCustomer) {
      setCustomerToDelete(dbCustomer);
      setDeleteDialogOpen(true);
    }
  };

  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to load people.";
      const isForbidden = typeof error === "object" && error !== null && "code" in error && String((error as { code?: string }).code) === "PGRST301";
      return (
        <Card>
          <CardContent className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-gardens-red-dk text-sm">
              {isForbidden
                ? "You don't have permission to view people, or the session may have expired."
                : message}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (filteredCustomers.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Users className="h-10 w-10 text-gardens-txs mx-auto" />
            <div className="text-lg font-medium">No people found</div>
            <div className="text-sm text-gardens-tx">
              {searchQuery ? "Try adjusting your search." : "Create your first person to get started."}
            </div>
            <Button onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Person
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-md border overflow-x-auto min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="hidden lg:table-cell">City</TableHead>
              <TableHead className="hidden lg:table-cell">Country</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.fullName}</TableCell>
                <TableCell className="hidden md:table-cell">{customer.email || "—"}</TableCell>
                <TableCell>{customer.phone || "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{customer.city || "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{customer.country || "—"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {customer.createdAt ? formatDateDMY(customer.createdAt) : "—"}
                </TableCell>
                <TableCell className="text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(customer.id)}>
                    <Pencil className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(customer.id)}>
                    <Trash2 className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">People</h1>
          <p className="text-sm text-gardens-tx mt-1">Manage people records and contact details.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gardens-txs" />
            <Input
              placeholder="Search name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Person
          </Button>
        </div>
      </div>

      {renderTable()}

      <CreateCustomerDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />

      {customerToEdit && (
        <EditCustomerDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) {
              setCustomerToEdit(null);
              setSearchParams((prev) => {
                if (!prev.get('customer')) return prev;
                const next = new URLSearchParams(prev);
                next.delete('customer');
                return next;
              });
            }
          }}
          customer={customerToEdit}
        />
      )}

      {customerToDelete && (
        <DeleteCustomerDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setCustomerToDelete(null);
          }}
          customer={customerToDelete}
        />
      )}
    </div>
  );
};

