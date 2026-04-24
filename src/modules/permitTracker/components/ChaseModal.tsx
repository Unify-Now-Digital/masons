import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Lock, AlertTriangle, Send, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateOrderComment } from '../hooks/useOrderComments';
import { getChaseDraft } from '../utils/chaseTemplates';
import type {
  PermitOrder,
  ChaseTarget,
  ChaseContext,
  ChaseScenario,
} from '../types/permitTracker.types';

interface ChaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: PermitOrder[];
  target: ChaseTarget;
  context: ChaseContext;
}

const VARIABLE_PILLS = [
  '{deceased_name}',
  '{customer_name}',
  '{cemetery_name}',
  '{order_ref}',
  '{permit_submitted_at}',
];

export function ChaseModal({ open, onOpenChange, orders, target, context }: ChaseModalProps) {
  const order = orders[0];
  const cemetery = order?.cemetery ?? null;

  const createComment = useCreateOrderComment();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine scenario
  const scenario: ChaseScenario = !order?.permit_gmail_thread_id
    ? 'B'
    : order.permit_correspondence_email
      ? 'A'
      : 'C';

  const draft = order
    ? getChaseDraft(target, context, orders, cemetery)
    : { subject: '', body: '', to: '' };

  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);

  // Reset form when order changes
  useEffect(() => {
    if (order) {
      const d = getChaseDraft(target, context, orders, cemetery);
      setTo(d.to);
      setSubject(scenario === 'A' ? `Re: ${d.subject}` : d.subject);
      setBody(d.body);
    }
  }, [order?.id, target, context, open]);

  // Highlight [SPECIFY DOCUMENT] placeholder
  const hasPlaceholder = body.includes('[SPECIFY DOCUMENT]');

  function handleInsertVariable(variable: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.slice(0, start) + variable + body.slice(end);
    setBody(newBody);
    // Restore cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }

  function handleSend() {
    if (!order) return;

    // Log the chase as a comment on each order
    const orderIds = context === 'multi' ? orders.map((o) => o.id) : [order.id];
    const account = order.permit_correspondence_email ?? 'current account';
    const now = new Date().toLocaleString('en-GB');

    for (const orderId of orderIds) {
      createComment.mutate({
        order_id: orderId,
        author: 'Aylin',
        body: `Chase email sent to ${target} via ${account} on ${now}`,
        comment_type: 'chase_sent',
      });
    }

    toast.success('Chase email drafted', {
      description: 'Email has been prepared. Open Gmail to send.',
      duration: 3000,
    });

    onOpenChange(false);
  }

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {target === 'cemetery' ? 'Chase cemetery' : 'Chase customer'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scenario info strips */}
          {scenario === 'A' && (
            <Alert className="border-gardens-grn-lt bg-gardens-grn-lt">
              <Lock className="h-4 w-4 text-gardens-grn-dk" />
              <AlertDescription className="text-sm">
                Replying to existing thread — locked to{' '}
                <Badge variant="outline" className="text-xs ml-1">
                  {order.permit_correspondence_email}
                </Badge>
              </AlertDescription>
            </Alert>
          )}

          {scenario === 'B' && (
            <Alert className="border-gardens-blu-lt bg-gardens-blu-lt">
              <Info className="h-4 w-4 text-gardens-blu-dk" />
              <AlertDescription className="text-sm">
                No prior thread found. Whichever account you send from will be locked to this order.
              </AlertDescription>
            </Alert>
          )}

          {scenario === 'C' && (
            <Alert className="border-gardens-amb-lt bg-gardens-amb-lt">
              <AlertTriangle className="h-4 w-4 text-gardens-amb-dk" />
              <AlertDescription className="text-sm">
                Prior thread found on{' '}
                <strong>{order.permit_correspondence_email}</strong>.
                Sending from a different address will start a new thread.
              </AlertDescription>
            </Alert>
          )}

          {/* To field */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">To</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Subject field */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              readOnly={scenario === 'A'}
              className={`mt-1 ${scenario === 'A' ? 'bg-muted' : ''}`}
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Body</label>
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`mt-1 min-h-[240px] font-mono text-sm ${hasPlaceholder ? 'border-gardens-amb-lt' : ''}`}
            />
            {hasPlaceholder && (
              <p className="text-xs text-gardens-amb-dk mt-1">
                Replace [SPECIFY DOCUMENT] with the document the cemetery has requested.
              </p>
            )}
          </div>

          {/* Variable pills */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Insert variable:</p>
            <div className="flex flex-wrap gap-1">
              {VARIABLE_PILLS.map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => handleInsertVariable(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          {/* Multi-order summary */}
          {context === 'multi' && orders.length > 1 && (
            <p className="text-xs text-muted-foreground">
              This email covers {orders.length} orders at {cemetery?.name ?? order.location}.
            </p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={createComment.isPending}>
            <Send className="h-4 w-4 mr-1" />
            {scenario === 'B' ? 'Send & lock to this account' : 'Send reply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
