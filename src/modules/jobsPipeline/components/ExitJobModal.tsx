import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { useExitJob } from '../hooks/useJobMutations';
import {
  AFTER_PAID_STAGES,
  type JobExitReason,
  type PipelineJob,
  type PostPaidExitReason,
  type PrePaidExitReason,
} from '../types/jobsPipeline.types';
import { getJobDisplayName } from '../utils/display';

const REASONS: { value: PrePaidExitReason; label: string; hint: string }[] = [
  { value: 'lost', label: 'Lost', hint: 'Went quiet or chose another mason.' },
  { value: 'closed', label: 'Closed', hint: 'Resolved without an order.' },
  { value: 'dormant', label: 'Dormant', hint: 'Pause until a wake date.' },
];

// Post-paid exits are a different pair: paying customers are held or cancelled,
// not lost. The phase split is UI policy (the DB CHECK permits all five).
const POST_PAID_REASONS: { value: PostPaidExitReason; label: string; hint: string }[] = [
  { value: 'on_hold', label: 'On hold', hint: 'Paused after payment — pick up later.' },
  { value: 'cancelled', label: 'Cancelled', hint: 'Order cancelled after payment.' },
];

interface ExitJobModalProps {
  /** Job being exited; null keeps the dialog closed. */
  job: PipelineJob | null;
  onClose: () => void;
}

export function ExitJobModal({ job, onClose }: ExitJobModalProps) {
  const [reason, setReason] = useState<JobExitReason | null>(null);
  const [wakeDate, setWakeDate] = useState('');
  const exitMutation = useExitJob();

  // The job's own stage decides which reason set applies — no caller wiring to get wrong.
  const isAfterPaid = !!job && (AFTER_PAID_STAGES as readonly string[]).includes(job.stage);
  const reasons = isAfterPaid ? POST_PAID_REASONS : REASONS;

  // Fresh form each time a job is picked.
  useEffect(() => {
    setReason(null);
    setWakeDate('');
  }, [job?.id]);

  const needsWakeDate = reason === 'dormant';
  const canConfirm = !!job && !!reason && (!needsWakeDate || !!wakeDate) && !exitMutation.isPending;

  const confirm = () => {
    if (!job || !reason) return;
    exitMutation.mutate(
      {
        jobId: job.id,
        reason,
        wakeAt: needsWakeDate ? new Date(`${wakeDate}T00:00:00`).toISOString() : null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exit pipeline</DialogTitle>
          <DialogDescription>
            {job ? `Remove ${getJobDisplayName(job)} from the active board. ` : ''}
            Nothing is deleted — exited jobs can be reopened from the Exited list.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason ?? ''}
          onValueChange={(value) => setReason(value as JobExitReason)}
          className="space-y-2"
        >
          {reasons.map(({ value, label, hint }) => (
            <label
              key={value}
              className="flex items-start gap-3 rounded-md border border-gardens-bdr p-3 cursor-pointer hover:bg-gardens-page/60"
            >
              <RadioGroupItem value={value} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gardens-tx">{label}</span>
                <span className="block text-xs text-gardens-txs">{hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>

        {needsWakeDate ? (
          <div className="space-y-1.5">
            <Label htmlFor="exit-wake-date" className="text-xs text-gardens-txs">
              Wake date (required)
            </Label>
            <Input
              id="exit-wake-date"
              type="date"
              className="h-9 w-[180px]"
              value={wakeDate}
              onChange={(e) => setWakeDate(e.target.value)}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={exitMutation.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={!canConfirm}>
            {exitMutation.isPending ? 'Exiting…' : 'Exit job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
