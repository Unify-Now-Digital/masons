import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Mail, MessageCircle } from 'lucide-react';
import { useCustomersList, type Customer } from '@/modules/customers/hooks/useCustomers';
import { cn } from '@/shared/lib/utils';

export type NewConversationChannel = 'email' | 'whatsapp';

export interface NewConversationResult {
  channel: NewConversationChannel;
  primary_handle: string;
  subject?: string | null;
  person_id?: string | null;
}

const CHANNELS: { value: NewConversationChannel; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'email', label: 'Email', Icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
];

function getPersonDisplayName(c: Customer): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email || c.phone || '—';
}

/** Simple email validation */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Basic phone validation (digits, optional + at start, reasonable length) */
function isValidPhone(value: string): boolean {
  const cleaned = value.trim().replace(/\s/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
}

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (result: NewConversationResult) => void;
  /** When opening from channel empty state / Customers start flow */
  initialChannel?: NewConversationChannel;
  initialPersonId?: string | null;
  /** Hide channel + "new recipient" when starting from a fixed workspace context */
  lockChannel?: boolean;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  open,
  onOpenChange,
  onStart,
  initialChannel,
  initialPersonId,
  lockChannel = false,
}) => {
  const [channel, setChannel] = useState<NewConversationChannel>('email');
  const [recipientMode, setRecipientMode] = useState<'customer' | 'new'>('customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [subject, setSubject] = useState('');

  const { data: customers = [] } = useCustomersList();

  useEffect(() => {
    if (!open) return;
    setChannel(initialChannel ?? 'email');
    if (initialPersonId) {
      setRecipientMode('customer');
      setSelectedCustomerId(initialPersonId);
    } else {
      setRecipientMode('customer');
      setSelectedCustomerId('');
    }
    if (!initialPersonId && !lockChannel) {
      setNewEmail('');
      setNewPhone('');
    }
    setSubject('');
  }, [open, initialChannel, initialPersonId, lockChannel]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const primaryHandle = useMemo(() => {
    if (recipientMode === 'new') {
      return channel === 'email' ? newEmail.trim() : newPhone.trim().replace(/\s/g, '');
    }
    if (!selectedCustomer) return '';
    if (channel === 'email') return selectedCustomer.email?.trim() ?? '';
    return selectedCustomer.phone?.trim().replace(/\s/g, '') ?? '';
  }, [recipientMode, channel, selectedCustomer, newEmail, newPhone]);

  const validationError = useMemo(() => {
    if (channel === 'email') {
      if (!primaryHandle) return 'Enter an email address or select a customer with an email.';
      if (!isValidEmail(primaryHandle)) return 'Enter a valid email address.';
      if (!subject.trim()) return 'Subject is required.';
    } else {
      if (!primaryHandle) return 'Enter a phone number or select a customer with a phone.';
      if (!isValidPhone(primaryHandle)) return 'Enter a valid phone number (e.g. +44 7xxx or 07xxx).';
    }
    return null;
  }, [channel, primaryHandle, subject]);

  const canSubmit = !validationError && primaryHandle.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onStart({
      channel,
      primary_handle: primaryHandle,
      subject: channel === 'email' ? subject.trim() : null,
      person_id: recipientMode === 'customer' && selectedCustomerId ? selectedCustomerId : null,
    });
    onOpenChange(false);
    setSubject('');
    setNewEmail('');
    setNewPhone('');
    setSelectedCustomerId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!lockChannel ? (
            <div>
              <Label className="text-sm font-medium text-gardens-tx">Channel</Label>
              <div className="mt-1.5 flex gap-2">
                {CHANNELS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setChannel(value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      channel === value
                        ? 'border-gardens-grn bg-gardens-grn-lt text-gardens-grn-dk'
                        : 'border-gardens-bdr bg-white text-gardens-tx hover:bg-gardens-page'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-sm font-medium text-gardens-tx">Channel</Label>
              <p className="mt-1.5 text-sm text-gardens-tx">
                {channel === 'email' ? 'Email' : 'WhatsApp'}
              </p>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium text-gardens-tx">Recipient</Label>
            {!lockChannel && (
              <div className="mt-1.5 flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={recipientMode === 'customer'}
                    onChange={() => setRecipientMode('customer')}
                    className="h-3.5 w-3.5 border-gardens-bdr text-gardens-grn-dk focus:ring-gardens-grn"
                  />
                  Existing customer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={recipientMode === 'new'}
                    onChange={() => setRecipientMode('new')}
                    className="h-3.5 w-3.5 border-gardens-bdr text-gardens-grn-dk focus:ring-gardens-grn"
                  />
                  New recipient
                </label>
              </div>
            )}

            {recipientMode === 'customer' ? (
              <div className="mt-2 space-y-2">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={lockChannel}
                  className="w-full rounded-md border border-gardens-bdr bg-white px-3 py-2 text-sm text-gardens-tx focus:border-gardens-grn focus:outline-none focus:ring-1 focus:ring-gardens-grn disabled:bg-gardens-page"
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getPersonDisplayName(c)} {c.email ? `(${c.email})` : ''} {c.phone ? ` ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
                {selectedCustomer && (
                  <p className="text-xs text-gardens-txs">
                    {channel === 'email'
                      ? selectedCustomer.email
                        ? `Using: ${selectedCustomer.email}`
                        : 'This customer has no email.'
                      : selectedCustomer.phone
                        ? `Using: ${selectedCustomer.phone}`
                        : 'This customer has no phone number.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-2">
                {channel === 'email' ? (
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full"
                  />
                ) : (
                  <Input
                    type="tel"
                    placeholder="+44 7xxx or 07xxx"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full"
                  />
                )}
              </div>
            )}
          </div>

          {channel === 'email' && (
            <div>
              <Label className="text-sm font-medium text-gardens-tx">Subject</Label>
              <Input
                type="text"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 w-full"
              />
            </div>
          )}

          {validationError && (
            <p className="text-sm text-gardens-amb-dk">{validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            Start Conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
