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
import { useDeleteJob, type Job } from '../hooks/useJobs';
import { useToast } from '@/shared/hooks/use-toast';

interface DeleteJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

export const DeleteJobDialog: React.FC<DeleteJobDialogProps> = ({
  open,
  onOpenChange,
  job,
}) => {
  const { mutate: deleteJob, isPending } = useDeleteJob();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteJob(job.id, {
      onSuccess: () => {
        toast({
          title: 'Job deleted',
          description: 'Job has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const description =
          error instanceof Error ? error.message : 'Failed to delete job.';
        toast({
          title: 'Error deleting job',
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
            This action cannot be undone. This will permanently delete the job for{' '}
            <strong>{job.customer_name}</strong> at <strong>{job.location_name}</strong>
            {job.status && ` (Status: ${job.status.replace('_', ' ')})`}.
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

