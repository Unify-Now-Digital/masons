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
import { useDeleteOrder } from '../hooks/useOrders';
import { useToast } from '@/shared/hooks/use-toast';
import type { Order } from '../types/orders.types';

interface DeleteOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}

export const DeleteOrderDialog: React.FC<DeleteOrderDialogProps> = ({
  open,
  onOpenChange,
  order,
}) => {
  const { mutate: deleteOrder, isPending } = useDeleteOrder();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteOrder(order.id, {
      onSuccess: () => {
        toast({
          title: 'Order deleted',
          description: 'Order has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const description = error instanceof Error ? error.message : 'Failed to delete order.';
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
            This action cannot be undone. This will permanently delete the order for{' '}
            <strong>{order.customer_name}</strong> (Order ID: {order.id.substring(0, 8)}...).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteOrderDialog;

