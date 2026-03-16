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
import { useToast } from '@/shared/hooks/use-toast';
import { useDeleteProduct } from '../hooks/useProducts';
import type { UIProduct } from '../utils/productTransform';

interface DeleteProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: UIProduct;
}

export const DeleteProductDialog: React.FC<DeleteProductDialogProps> = ({ open, onOpenChange, product }) => {
  const { mutate: deleteProduct, isPending } = useDeleteProduct();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteProduct(product.id, {
      onSuccess: () => {
        toast({
          title: 'Product deleted',
          description: 'Product has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const msg = error instanceof Error ? error.message : 'Failed to delete product.';
        toast({
          title: 'Error deleting product',
          description: msg,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Product</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{product.name}</strong>? This action cannot be undone.
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

