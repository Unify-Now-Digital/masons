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
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { useDeleteCemetery, type CemeteryWithCounts } from '../hooks/useCemeteries';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cemetery: CemeteryWithCounts;
}

export const DeleteCemeteryDialog: React.FC<Props> = ({ open, onOpenChange, cemetery }) => {
  const { mutate: deleteCemetery, isPending } = useDeleteCemetery();
  const { toast } = useToast();

  const hasLinks = cemetery.orderCount > 0 || cemetery.permitFormCount > 0;

  const handleDelete = () => {
    deleteCemetery(cemetery.id, {
      onSuccess: () => {
        toast({ title: 'Cemetery deleted', description: `${cemetery.name} has been removed.` });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        toast({
          title: 'Error deleting cemetery',
          description: error instanceof Error ? error.message : 'Failed to delete cemetery.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete cemetery?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete{' '}
            <span className="font-semibold">{cemetery.name}</span>.
            {hasLinks && (
              <>
                {' '}
                <span className="text-gardens-red-dk">
                  {cemetery.orderCount > 0 &&
                    `${cemetery.orderCount} order${cemetery.orderCount === 1 ? '' : 's'}`}
                  {cemetery.orderCount > 0 && cemetery.permitFormCount > 0 && ' and '}
                  {cemetery.permitFormCount > 0 &&
                    `${cemetery.permitFormCount} permit form${cemetery.permitFormCount === 1 ? '' : 's'}`}
                  {' '}still reference it — their cemetery link will be cleared.
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
