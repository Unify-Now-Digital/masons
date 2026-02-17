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
import { Send, Paperclip, FileText, Loader2 } from 'lucide-react';
import type { PermitPipelineItem } from '../types/permitAgent.types';

interface SubmitPermitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PermitPipelineItem | null;
  onSubmit: (data: { to: string; subject: string; body: string }) => void;
  isSubmitting?: boolean;
}

export const SubmitPermitDialog: React.FC<SubmitPermitDialogProps> = ({
  open,
  onOpenChange,
  item,
  onSubmit,
  isSubmitting,
}) => {
  const order = item?.order;
  const permit = item?.permit;

  const defaultTo = permit?.authority_contact || '';
  const defaultSubject = order
    ? `Memorial Permit Application - ${order.customer_name} - ${order.location || 'Location TBD'}`
    : 'Memorial Permit Application';
  const defaultBody = order
    ? `Dear ${permit?.authority_name || 'Sir/Madam'},

I am writing to submit a memorial permit application for the following:

Deceased: ${order.customer_name}
Location: ${order.location || 'To be confirmed'}
Memorial Type: ${order.order_type}
Material: ${order.material || 'To be confirmed'}

Please find the completed application form attached.

If you require any further information, please do not hesitate to contact us.

Kind regards,
Memorial Mason Management`
    : '';

  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  // Reset form when dialog opens with new item
  React.useEffect(() => {
    if (open && item) {
      setTo(permit?.authority_contact || '');
      setSubject(
        `Memorial Permit Application - ${order?.customer_name || ''} - ${order?.location || 'Location TBD'}`
      );
      setBody(
        `Dear ${permit?.authority_name || 'Sir/Madam'},

I am writing to submit a memorial permit application for the following:

Deceased: ${order?.customer_name || ''}
Location: ${order?.location || 'To be confirmed'}
Memorial Type: ${order?.order_type || ''}
Material: ${order?.material || 'To be confirmed'}

Please find the completed application form attached.

If you require any further information, please do not hesitate to contact us.

Kind regards,
Memorial Mason Management`
      );
    }
  }, [open, item?.permit.id]);

  const handleSubmit = () => {
    onSubmit({ to, subject, body });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Submit Permit Application
          </DialogTitle>
          <DialogDescription>
            Draft an email to the issuing authority with the pre-filled application attached.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              placeholder="clerk@council.gov.uk"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="resize-none"
            />
          </div>

          {permit?.form_url && (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
              <Paperclip className="h-4 w-4 text-slate-400" />
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Pre-filled permit application attached</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !to.trim()}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isSubmitting ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
