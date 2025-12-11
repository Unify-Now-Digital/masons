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
import { useDeletePayment } from '../hooks/usePayments';
import { useToast } from '@/shared/hooks/use-toast';
import type { Payment } from '../hooks/usePayments';
import { format } from 'date-fns';

interface DeletePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
}

export const DeletePaymentDialog: React.FC<DeletePaymentDialogProps> = ({
  open,
  onOpenChange,
  payment,
}) => {
  const { mutate: deletePayment, isPending } = useDeletePayment();
  const { toast } = useToast();

  const handleDelete = () => {
    deletePayment(payment.id, {
      onSuccess: () => {
        toast({
          title: 'Payment deleted',
          description: 'Payment has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to delete payment.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error deleting payment',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatMethod = (method: string) => {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Payment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this payment?
            <br />
            <br />
            <strong>Amount:</strong> {formatCurrency(payment.amount)}
            <br />
            <strong>Date:</strong> {format(new Date(payment.date), 'PPP')}
            <br />
            <strong>Method:</strong> {formatMethod(payment.method)}
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

