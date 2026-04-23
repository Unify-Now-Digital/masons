import React, { useEffect, useMemo, useState } from 'react';
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
import { useToast } from '@/shared/hooks/use-toast';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { deleteOrganization } from '@/modules/organizations';

export interface DeleteOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onDeleted?: () => void;
}

export function DeleteOrganizationModal({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onDeleted,
}: DeleteOrganizationModalProps) {
  const { toast } = useToast();
  const { refetchMemberships } = useOrganization();
  const [confirmationText, setConfirmationText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmationText('');
      setSubmitting(false);
    }
  }, [open]);

  const canDelete = useMemo(
    () => confirmationText === organizationName && !submitting,
    [confirmationText, organizationName, submitting],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;

    setSubmitting(true);
    try {
      await deleteOrganization(organizationId);
      await refetchMemberships();
      onDeleted?.();
      onOpenChange(false);
      toast({ title: 'Organisation deleted' });
    } catch (err) {
      toast({
        title: 'Could not delete organisation',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      // Keep modal open on error so user can retry or cancel.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-destructive/50 bg-gardens-surf sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-head text-destructive">Delete organisation</DialogTitle>
            <DialogDescription className="font-body text-gardens-txs">
              This will permanently delete <span className="font-semibold text-gardens-tx">{organizationName}</span> and its data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="delete-org-confirm" className="text-xs text-gardens-txs">
              Type <span className="font-semibold text-gardens-tx">{organizationName}</span> to confirm
            </Label>
            <Input
              id="delete-org-confirm"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={submitting}
              className="text-sm bg-gardens-page"
              autoComplete="off"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={!canDelete}>
              {submitting ? 'Deleting…' : 'Delete organisation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
