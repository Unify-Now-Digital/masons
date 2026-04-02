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
import { Mail, Paperclip, FileText, Loader2 } from 'lucide-react';
import type { PermitPipelineItem } from '../types/permitAgent.types';

interface SendToClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PermitPipelineItem | null;
  onSend: (data: { to: string; subject: string; body: string }) => void;
  isSending?: boolean;
}

export const SendToClientDialog: React.FC<SendToClientDialogProps> = ({
  open,
  onOpenChange,
  item,
  onSend,
  isSending,
}) => {
  const order = item?.order;
  const permit = item?.permit;

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Reset form when dialog opens with new item
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open && item) {
      setTo('');
      setSubject(
        `Memorial Permit Application - ${order?.customer_name || ''} - ${order?.location || 'Location TBD'}`
      );
      setBody(
        `Dear Customer,

We are writing regarding the memorial permit application for ${order?.customer_name || ''} at ${order?.location || 'the cemetery'}.

We have prepared the permit application form${permit?.authority_name ? ` for ${permit.authority_name}` : ''}. Please review the attached form, sign where indicated, and return it to us at your earliest convenience.

Order Details:
- Order Reference: #${order?.order_number || '—'}
- Location: ${order?.location || 'To be confirmed'}
- Grave Number: ${order?.material || 'To be confirmed'}
- Memorial Type: ${order?.order_type || ''}

${permit?.form_url ? `You can also view the form online at: ${permit.form_url}\n` : ''}If you have any questions, please don't hesitate to contact us.

Kind regards,
Memorial Mason Management`
      );
    }
  }, [open, item?.permit.id]);

  const handleSend = () => {
    onSend({ to, subject, body });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Send Permit Form to Client
          </DialogTitle>
          <DialogDescription>
            Send the pre-filled permit application to the customer for review and signature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="client-to">To (Customer Email)</Label>
            <Input
              id="client-to"
              type="email"
              placeholder="customer@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-subject">Subject</Label>
            <Input
              id="client-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-body">Message</Label>
            <Textarea
              id="client-body"
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="resize-none"
            />
          </div>

          {permit?.form_url && (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
              <Paperclip className="h-4 w-4 text-slate-400" />
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Pre-filled permit form will be attached</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !to.trim()}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {isSending ? 'Sending...' : 'Send to Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
