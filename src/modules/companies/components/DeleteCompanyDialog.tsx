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
import { useDeleteCompany, type Company } from '../hooks/useCompanies';
import { useToast } from '@/shared/hooks/use-toast';

interface DeleteCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

export const DeleteCompanyDialog: React.FC<DeleteCompanyDialogProps> = ({
  open,
  onOpenChange,
  company,
}) => {
  const { mutate: deleteCompany, isPending } = useDeleteCompany();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteCompany(company.id, {
      onSuccess: () => {
        toast({
          title: 'Company deleted',
          description: `${company.name} has been deleted successfully.`,
        });
        onOpenChange(false);
      },
      onError: (error: Error) => {
        toast({
          title: 'Error deleting company',
          description: error?.message || 'Failed to delete company.',
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
            This action cannot be undone. This will permanently delete{' '}
            <strong>{company.name}</strong>
            {company.email && ` (${company.email})`}.
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

