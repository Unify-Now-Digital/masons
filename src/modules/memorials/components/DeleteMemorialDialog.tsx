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
import { useDeleteMemorial } from '../hooks/useMemorials';
import { useToast } from '@/shared/hooks/use-toast';
import type { Memorial } from '../hooks/useMemorials';

interface DeleteMemorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memorial: Memorial;
}

export const DeleteMemorialDialog: React.FC<DeleteMemorialDialogProps> = ({
  open,
  onOpenChange,
  memorial,
}) => {
  const { mutate: deleteMemorial, isPending } = useDeleteMemorial();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteMemorial(memorial.id, {
      onSuccess: () => {
        toast({
          title: 'Memorial deleted',
          description: 'Memorial has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to delete memorial.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error deleting memorial',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Memorial</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the memorial for{' '}
            <strong>{memorial.deceased_name}</strong> at{' '}
            <strong>{memorial.cemetery_name}</strong>? This action cannot be undone.
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

