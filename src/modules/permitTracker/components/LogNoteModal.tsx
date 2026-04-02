import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { useCreateOrderComment } from '../hooks/useOrderComments';
import type { PermitOrder } from '../types/permitTracker.types';

interface LogNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PermitOrder | null;
}

export function LogNoteModal({ open, onOpenChange, order }: LogNoteModalProps) {
  const [body, setBody] = useState('');
  const createComment = useCreateOrderComment();

  const orderRef = order?.order_number
    ? `ORD-${String(order.order_number).padStart(4, '0')}`
    : order?.id.slice(0, 8) ?? '';

  function handleSave() {
    if (!order || !body.trim()) return;

    createComment.mutate(
      {
        order_id: order.id,
        author: 'Aylin',
        body: body.trim(),
        comment_type: 'note',
      },
      {
        onSuccess: () => {
          toast.success('Note saved', { duration: 2000 });
          setBody('');
          onOpenChange(false);
        },
        onError: () => {
          toast.error('Failed to save note');
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log note</DialogTitle>
        </DialogHeader>

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note..."
          autoFocus
          className="min-h-[120px]"
        />

        <p className="text-xs text-muted-foreground">
          Saved as note on order {orderRef} · visible to all team members
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!body.trim() || createComment.isPending}
          >
            {createComment.isPending ? 'Saving...' : 'Save note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
