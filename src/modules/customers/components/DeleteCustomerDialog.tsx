import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { useDeleteCustomer, type Customer } from "../hooks/useCustomers";

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
}

export const DeleteCustomerDialog: React.FC<DeleteCustomerDialogProps> = ({
  open,
  onOpenChange,
  customer,
}) => {
  const { mutate: deleteCustomer, isPending } = useDeleteCustomer();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteCustomer(customer.id, {
      onSuccess: () => {
        toast({
          title: "Person deleted",
          description: `${customer.first_name} ${customer.last_name} has been removed.`,
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const description =
          error instanceof Error ? error.message : "Failed to delete person.";
        toast({
          title: "Error deleting person",
          description,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete person?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete{" "}
            <span className="font-semibold">
              {customer.first_name} {customer.last_name}
            </span>
            {customer.email ? ` (${customer.email})` : ""} from the people list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

