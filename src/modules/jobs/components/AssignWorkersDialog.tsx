import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { useWorkers, useWorkersByJob, useSetWorkersForJob } from '@/modules/workers/hooks/useWorkers';

interface AssignWorkersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export const AssignWorkersDialog: React.FC<AssignWorkersDialogProps> = ({
  open,
  onOpenChange,
  jobId,
}) => {
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: workers } = useWorkers({ activeOnly: !includeInactive });
  const { data: assignedWorkers } = useWorkersByJob(jobId);
  const { mutate: setWorkers, isPending } = useSetWorkersForJob();
  const { toast } = useToast();

  // Initialize selected workers from assigned workers
  useEffect(() => {
    if (assignedWorkers && open) {
      setSelectedWorkerIds(assignedWorkers.map(w => w.id));
    }
  }, [assignedWorkers, open]);

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds(prev => {
      if (prev.includes(workerId)) {
        return prev.filter(id => id !== workerId);
      } else {
        return [...prev, workerId];
      }
    });
  };

  const handleSave = () => {
    setWorkers(
      { jobId, workerIds: selectedWorkerIds },
      {
        onSuccess: () => {
          toast({
            title: 'Workers assigned',
            description: `Successfully updated worker assignments for this job.`,
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : 'Failed to assign workers.';
          toast({
            title: 'Error assigning workers',
            description,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Workers</DialogTitle>
          <DialogDescription>
            Select workers to assign to this job. You can assign multiple workers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={(checked) => setIncludeInactive(checked === true)}
            />
            <label
              htmlFor="include-inactive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include inactive workers
            </label>
          </div>
          <div className="border rounded-md p-4 max-h-96 overflow-y-auto space-y-2">
            {!workers || workers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workers available</p>
            ) : (
              workers.map((worker) => (
                <div key={worker.id} className="flex items-center space-x-3 py-2">
                  <Checkbox
                    id={`worker-${worker.id}`}
                    checked={selectedWorkerIds.includes(worker.id)}
                    onCheckedChange={() => toggleWorker(worker.id)}
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    <Badge variant="outline" className="h-8 w-8 rounded-full flex items-center justify-center p-0">
                      {getInitials(worker.full_name)}
                    </Badge>
                    <div className="flex-1">
                      <label
                        htmlFor={`worker-${worker.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {worker.full_name}
                      </label>
                      <p className="text-xs text-muted-foreground">{worker.role}</p>
                    </div>
                    {!worker.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Assignments'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

