import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

interface BulkDeleteConversationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  title?: string;
  submitting?: boolean;
  onConfirm: () => void;
}

export function BulkDeleteConversationsDialog({
  open,
  onOpenChange,
  count,
  title,
  submitting = false,
  onConfirm,
}: BulkDeleteConversationsDialogProps) {
  const resolvedTitle = title ?? `Delete ${count} conversations? This cannot be undone.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gardens-bdr bg-gardens-surf sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-head text-gardens-tx">
            {resolvedTitle}
          </DialogTitle>
          <DialogDescription className="font-body text-gardens-txs">
            This will permanently remove the selected conversations and their messages.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onConfirm} disabled={submitting || count === 0}>
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
