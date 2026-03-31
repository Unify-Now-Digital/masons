import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Loader2, Mail, MessageSquare, CheckCircle2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useToast } from '@/shared/hooks/use-toast';
import { useSendProof } from '../hooks/useProofs';
import type { OrderProof } from '../types/proofs.types';
import {
  useLinkedContactsByCustomer,
  buildEmailOptions,
  buildPhoneOptions,
} from '@/modules/customers';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';

interface ProofSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proof: OrderProof;
  /** Signed URL for preview — fetched by ProofPanel before opening modal */
  renderUrl: string | null;
  customerId: string;
  onSuccess?: () => void;
}

const PREVIEW_MESSAGE =
  'Your memorial proof is ready for review. Reply YES to approve or let us know any changes needed.';

export const ProofSendModal: React.FC<ProofSendModalProps> = ({
  open,
  onOpenChange,
  proof,
  renderUrl,
  customerId,
  onSuccess,
}) => {
  const { toast } = useToast();
  const sendMutation = useSendProof();
  const { emails: linkedEmails, whatsapp: linkedWhatsapp } = useLinkedContactsByCustomer(customerId);
  const customerQuery = useCustomer(customerId);
  const customer = customerQuery.data;

  const emailOptions = useMemo(
    () => buildEmailOptions(linkedEmails, customer?.email),
    [linkedEmails, customer?.email],
  );
  const phoneOptions = useMemo(
    () => buildPhoneOptions(linkedWhatsapp, customer?.phone),
    [linkedWhatsapp, customer?.phone],
  );
  const emailOptionsKey = useMemo(() => emailOptions.join(','), [emailOptions]);
  const phoneOptionsKey = useMemo(() => phoneOptions.join(','), [phoneOptions]);
  const firstEmailOption = emailOptions[0] ?? '';
  const firstPhoneOption = phoneOptions[0] ?? '';

  const [emailEnabled, setEmailEnabled] = useState(emailOptions.length > 0);
  const [whatsappEnabled, setWhatsappEnabled] = useState(phoneOptions.length > 0);
  const [selectedEmail, setSelectedEmail] = useState<string>(firstEmailOption);
  const [selectedPhone, setSelectedPhone] = useState<string>(firstPhoneOption);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setSelectedEmail(firstEmailOption);
    setEmailEnabled(emailOptions.length > 0);
  }, [emailOptionsKey, firstEmailOption, emailOptions.length]);

  useEffect(() => {
    setSelectedPhone(firstPhoneOption);
    setWhatsappEnabled(phoneOptions.length > 0);
  }, [phoneOptionsKey, firstPhoneOption, phoneOptions.length]);

  const channels: ('email' | 'whatsapp')[] = [
    ...(emailEnabled && selectedEmail ? ['email' as const] : []),
    ...(whatsappEnabled && selectedPhone ? ['whatsapp' as const] : []),
  ];

  const handleSend = () => {
    if (!channels.length) return;

    sendMutation.mutate(
      {
        proof_id: proof.id,
        channels,
        customer_email: emailEnabled ? selectedEmail : undefined,
        customer_phone: whatsappEnabled ? selectedPhone : undefined,
      },
      {
        onSuccess: () => {
          setSent(true);
          toast({ title: 'Proof sent to customer' });
          onSuccess?.();
        },
      },
    );
  };

  const handleClose = () => {
    // Reset internal state on close so modal is fresh next time
    setSent(false);
    sendMutation.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        {sent ? (
          /* ── Success screen ───────────────────────────────────────────── */
          <>
            <DialogHeader>
              <DialogTitle>Proof Sent</DialogTitle>
              <DialogDescription>The customer has been notified.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm text-muted-foreground">
                Sent via{' '}
                {emailEnabled && whatsappEnabled
                  ? 'email and WhatsApp'
                  : emailEnabled
                    ? 'email'
                    : 'WhatsApp'}
                .
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        ) : (
          /* ── Send screen ──────────────────────────────────────────────── */
          <>
            <DialogHeader>
              <DialogTitle>Send Proof to Customer</DialogTitle>
              <DialogDescription>
                Choose how to deliver the proof image for customer approval.
              </DialogDescription>
            </DialogHeader>

            {/* Proof thumbnail */}
            {renderUrl ? (
              <img
                src={renderUrl}
                alt="Proof preview"
                className="w-full max-h-48 object-contain rounded border bg-slate-50"
              />
            ) : (
              <Skeleton className="w-full h-36 rounded" />
            )}

            {/* Channel selector */}
            <div className="space-y-3 mt-2">
              <p className="text-sm font-medium">Send via:</p>

              {/* Email */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center gap-3 rounded border px-3 py-2 ${
                      emailOptions.length > 0 ? 'cursor-default' : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Checkbox
                      id="send-email"
                      checked={emailEnabled}
                      onCheckedChange={(checked) => setEmailEnabled(!!checked)}
                      disabled={emailOptions.length === 0}
                    />
                    <Label
                      htmlFor="send-email"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Email
                        {emailOptions.length === 1 && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({emailOptions[0]})
                          </span>
                        )}
                      </span>
                    </Label>
                  </div>
                </TooltipTrigger>
                {emailOptions.length === 0 && (
                  <TooltipContent>No email address on file</TooltipContent>
                )}
              </Tooltip>
              {emailEnabled && emailOptions.length > 1 && (
                <RadioGroup value={selectedEmail} onValueChange={setSelectedEmail} className="pl-7">
                  {emailOptions.map((email) => (
                    <div key={email.toLowerCase()} className="flex items-center gap-2">
                      <RadioGroupItem value={email} id={`proof-email-${email}`} />
                      <Label htmlFor={`proof-email-${email}`} className="text-sm">
                        {email}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {/* WhatsApp */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center gap-3 rounded border px-3 py-2 ${
                      phoneOptions.length > 0 ? 'cursor-default' : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Checkbox
                      id="send-whatsapp"
                      checked={whatsappEnabled}
                      onCheckedChange={(checked) => setWhatsappEnabled(!!checked)}
                      disabled={phoneOptions.length === 0}
                    />
                    <Label
                      htmlFor="send-whatsapp"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>
                        WhatsApp
                        {phoneOptions.length === 1 && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({phoneOptions[0]})
                          </span>
                        )}
                      </span>
                    </Label>
                  </div>
                </TooltipTrigger>
                {phoneOptions.length === 0 && (
                  <TooltipContent>No phone number on file</TooltipContent>
                )}
              </Tooltip>
              {whatsappEnabled && phoneOptions.length > 1 && (
                <RadioGroup value={selectedPhone} onValueChange={setSelectedPhone} className="pl-7">
                  {phoneOptions.map((phone) => (
                    <div key={phone.toLowerCase()} className="flex items-center gap-2">
                      <RadioGroupItem value={phone} id={`proof-phone-${phone}`} />
                      <Label htmlFor={`proof-phone-${phone}`} className="text-sm">
                        {phone} <span className="text-muted-foreground">(WhatsApp)</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>

            {/* Message preview */}
            <div className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground border">
              <span className="font-medium text-foreground">Message preview: </span>
              {PREVIEW_MESSAGE}
            </div>

            {/* Error */}
            {sendMutation.isError && (
              <p className="text-sm text-destructive">
                {sendMutation.error instanceof Error
                  ? sendMutation.error.message
                  : 'Send failed. Please try again.'}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={sendMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={channels.length === 0 || sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send Proof'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
