import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useDeleteInvoice } from '../hooks/useInvoices';
import { useToast } from '@/shared/hooks/use-toast';
import type { Invoice } from '../types/invoicing.types';

interface DeleteInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onDeleted?: (invoiceId: string) => void;
}

export const DeleteInvoiceDialog: React.FC<DeleteInvoiceDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onDeleted,
}) => {
  const { mutate: deleteInvoice, isPending } = useDeleteInvoice();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteInvoice(invoice.id, {
      onSuccess: () => {
        toast({
          title: 'Invoice deleted',
          description: 'Invoice has been deleted successfully.',
        });
        onDeleted?.(invoice.id);
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const description = error instanceof Error ? error.message : 'Failed to delete invoice.';
        toast({
          title: 'Error',
          description,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete invoice{' '}
            <strong>{invoice.invoice_number}</strong> for{' '}
            <strong>{invoice.customer_name}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-gardens-red hover:bg-gardens-red-dk"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteInvoiceDialog;

