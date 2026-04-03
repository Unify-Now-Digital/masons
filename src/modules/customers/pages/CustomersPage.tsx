import React, { useMemo, useState } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

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
            <div className="text-red-600 text-sm">
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
            <Users className="h-10 w-10 text-slate-400 mx-auto" />
            <div className="text-lg font-medium">No people found</div>
            <div className="text-sm text-slate-600">
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
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.fullName}</TableCell>
                <TableCell>{customer.email || "—"}</TableCell>
                <TableCell>{customer.phone || "—"}</TableCell>
                <TableCell>{customer.city || "—"}</TableCell>
                <TableCell>{customer.country || "—"}</TableCell>
                <TableCell>
                  {customer.createdAt ? formatDateDMY(customer.createdAt) : "—"}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(customer.id)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(customer.id)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
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
          <p className="text-sm text-slate-600 mt-1">Manage people records and contact details.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
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
            if (!open) setCustomerToEdit(null);
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

