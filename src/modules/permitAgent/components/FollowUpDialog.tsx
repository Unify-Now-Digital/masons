import React, { useState } from 'react';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { Reply, Loader2 } from 'lucide-react';
import type { PermitPipelineItem } from '../types/permitAgent.types';

type Recipient = 'client' | 'authority';

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PermitPipelineItem | null;
  onSend: (data: { to: string; subject: string; body: string }) => void;
  isSending?: boolean;
}

export const FollowUpDialog: React.FC<FollowUpDialogProps> = ({
  open,
  onOpenChange,
  item,
  onSend,
  isSending,
}) => {
  const order = item?.order;
  const permit = item?.permit;

  const [recipient, setRecipient] = useState<Recipient>('client');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const buildEmail = (target: Recipient) => {
    const isClient = target === 'client';
    const toAddress = isClient ? '' : (permit?.authority_contact || '');
    const recipientName = isClient ? 'Customer' : (permit?.authority_name || 'Sir/Madam');
    const action = isClient
      ? 'Could you please return the signed form at your earliest convenience?'
      : 'Could you please provide an update on the status of this application?';
    const sub = `Follow-up: Memorial Permit Application - ${order?.customer_name || ''} - ${order?.location || 'Location TBD'}`;
    const bod = `Dear ${recipientName},

I am writing to follow up on the memorial permit application for:

- Deceased: ${order?.customer_name || ''}
- Location: ${order?.location || 'To be confirmed'}
- Memorial Type: ${order?.order_type || ''}
- Order Reference: #${order?.order_number || '—'}
${permit?.submission_date ? `- Submitted: ${permit.submission_date}` : ''}

${action}

Thank you for your time.

Kind regards,
Memorial Mason Management`;

    setTo(toAddress);
    setSubject(sub);
    setBody(bod);
  };

  // Reset form when dialog opens with new item
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open && item) {
      const defaultTarget = permit?.permit_phase === 'SENT_TO_CLIENT' ? 'client' : 'authority';
      setRecipient(defaultTarget);
      buildEmail(defaultTarget);
    }
  }, [open, item?.permit.id]);

  const handleRecipientChange = (target: Recipient) => {
    setRecipient(target);
    buildEmail(target);
  };

  const handleSend = () => {
    onSend({ to, subject, body });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Reply className="h-4 w-4" />
            Send Follow-up
          </DialogTitle>
          <DialogDescription>
            Send a follow-up reminder about the permit application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient toggle */}
          <div className="space-y-2">
            <Label>Send to</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={recipient === 'client' ? 'default' : 'outline'}
                onClick={() => handleRecipientChange('client')}
              >
                Client / Customer
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recipient === 'authority' ? 'default' : 'outline'}
                onClick={() => handleRecipientChange('authority')}
                disabled={!permit?.authority_contact}
              >
                Cemetery / Authority
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="followup-to">Email Address</Label>
            <Input
              id="followup-to"
              type="email"
              placeholder={recipient === 'client' ? 'customer@example.com' : 'clerk@council.gov.uk'}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followup-subject">Subject</Label>
            <Input
              id="followup-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followup-body">Message</Label>
            <Textarea
              id="followup-body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !to.trim()}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Reply className="h-4 w-4 mr-2" />
            )}
            {isSending ? 'Sending...' : 'Send Follow-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
