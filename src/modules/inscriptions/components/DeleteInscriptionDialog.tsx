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
import { useDeleteInscription } from '../hooks/useInscriptions';
import { useToast } from '@/shared/hooks/use-toast';
import type { Inscription } from '../hooks/useInscriptions';

interface DeleteInscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inscription: Inscription;
}

export const DeleteInscriptionDialog: React.FC<DeleteInscriptionDialogProps> = ({
  open,
  onOpenChange,
  inscription,
}) => {
  const { mutate: deleteInscription, isPending } = useDeleteInscription();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteInscription(inscription.id, {
      onSuccess: () => {
        toast({
          title: 'Inscription deleted',
          description: 'Inscription has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to delete inscription.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error deleting inscription',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  const inscriptionSnippet = inscription.inscription_text.length > 50
    ? `${inscription.inscription_text.substring(0, 50)}...`
    : inscription.inscription_text;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Inscription</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the <strong>{inscription.type}</strong> inscription?
            <br />
            <br />
            <strong>Snippet:</strong> "{inscriptionSnippet}"
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

