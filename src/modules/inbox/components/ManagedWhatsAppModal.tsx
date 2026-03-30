import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/shared/components/ui/badge';
import { CheckCircle2, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
import {
  useManagedWhatsAppStatus,
  useManagedWhatsAppStart,
  useManagedWhatsAppSubmitBusiness,
  useManagedWhatsAppMeta,
  useManagedWhatsAppDisconnect,
} from '../hooks/useWhatsAppConnection';
import { useToast } from '@/shared/hooks/use-toast';
import type { ManagedWhatsAppStatusResponse } from '../api/whatsappConnections.api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModalStep =
  | 'start'           // No row / draft / not_connected
  | 'business_form'   // collecting_business_info only (fresh entry via start step)
  | 'pending'         // pending_provider_review / provisioning / requested / pending_meta_action
  | 'action_required' // Distinct screen: reason message + pre-populated re-submit form
  | 'failed'          // failed / error / degraded
  | 'connected'       // Truly connected (all 4 criteria satisfied)
  | 'disconnected';   // Disconnected

export interface ManagedWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported so WhatsAppConnectionStatus can import them)
// ---------------------------------------------------------------------------

/**
 * Derives the modal screen to render from the current managed status.
 * Pure function — no side effects, no React hooks.
 */
export function deriveModalStep(
  managedStatus: ManagedWhatsAppStatusResponse | null | undefined,
  isConnected: boolean,
): ModalStep {
  if (
    !managedStatus?.exists ||
    managedStatus.status === 'draft' ||
    managedStatus.status === 'not_connected'
  ) {
    return 'start';
  }
  if (isConnected) return 'connected';
  switch (managedStatus.status) {
    case 'collecting_business_info': return 'business_form';
    case 'pending_provider_review':
    case 'provisioning':
    case 'requested':
    case 'pending_meta_action':      return 'pending';
    case 'action_required':          return 'action_required';
    case 'failed':
    case 'error':
    case 'degraded':                 return 'failed';
    case 'disconnected':             return 'disconnected';
    case 'connected':
      // connected state without all 4 criteria = treat as degraded/failed
      return 'failed';
    default:                         return 'start';
  }
}

/**
 * Returns a context-appropriate dropdown menu label for the current managed state.
 * Exported so WhatsAppConnectionStatus can use it without duplicating the logic.
 */
export function getManagedMenuLabel(status: string | undefined, exists: boolean): string {
  if (!exists || status === 'draft' || status === 'not_connected' || !status) {
    return 'Connect via Managed WhatsApp';
  }
  switch (status) {
    case 'collecting_business_info':  return 'Resume onboarding';
    case 'pending_provider_review':
    case 'provisioning':
    case 'requested':                 return 'View pending status';
    case 'pending_meta_action':
    case 'action_required':           return 'Resolve action required';
    case 'failed':
    case 'error':
    case 'degraded':                  return 'Onboarding failed — start over';
    case 'connected':                 return 'Manage connection';
    case 'disconnected':              return 'Reconnect WhatsApp';
    default:                          return 'Connect via Managed WhatsApp';
  }
}

// ---------------------------------------------------------------------------
// Step screens
// ---------------------------------------------------------------------------

function StartScreen({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const managedStartMutation = useManagedWhatsAppStart();

  const handleStart = () => {
    managedStartMutation.mutate(undefined, {
      onError: (err) =>
        toast({
          title: 'Could not start onboarding',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        }),
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Connect WhatsApp (Managed)</DialogTitle>
        <DialogDescription>
          Connect your business WhatsApp without entering any Twilio credentials. We handle the
          provider setup — you just provide your business details.
        </DialogDescription>
      </DialogHeader>
      <div className="py-2 text-sm text-muted-foreground space-y-2">
        <p>You will be asked for:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Business name</li>
          <li>Business email</li>
          <li>Business phone number</li>
        </ul>
        <p>Provider setup typically takes a few minutes after submission.</p>
      </div>
      {managedStartMutation.isError && (
        <p className="text-sm text-destructive">
          {managedStartMutation.error instanceof Error
            ? managedStartMutation.error.message
            : 'Failed to start onboarding. Please try again.'}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleStart} disabled={managedStartMutation.isPending}>
          {managedStartMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting…
            </>
          ) : (
            'Get Started'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

function BusinessFormScreen({
  connectionId,
  initialValues,
  isActionRequired,
  reasonMessage,
}: {
  connectionId: string;
  initialValues?: { business_name: string; business_email: string; business_phone: string } | null;
  isActionRequired?: boolean;
  reasonMessage?: string | null;
}) {
  const { toast } = useToast();
  const managedSubmitMutation = useManagedWhatsAppSubmitBusiness();
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // Pre-populate from meta when available (action_required re-entry)
  useEffect(() => {
    if (initialValues) {
      setBusinessName(initialValues.business_name);
      setBusinessEmail(initialValues.business_email);
      setBusinessPhone(initialValues.business_phone);
    }
  }, [initialValues]);

  const isValid = businessName.trim() && businessEmail.trim() && businessPhone.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    managedSubmitMutation.mutate(
      {
        connection_id: connectionId,
        business_name: businessName.trim(),
        business_email: businessEmail.trim(),
        business_phone: businessPhone.trim(),
      },
      {
        onError: (err) =>
          toast({
            title: 'Could not submit details',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          }),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isActionRequired ? 'Action Required' : 'Your Business Details'}
        </DialogTitle>
        <DialogDescription>
          {isActionRequired ? 'Please review and re-submit your details.' : 'Step 2 of 3'}
        </DialogDescription>
      </DialogHeader>
      {isActionRequired && reasonMessage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{reasonMessage}</span>
          </div>
        </div>
      )}
      {isActionRequired && !reasonMessage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Provider needs additional information. Please review and re-submit your details.</span>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="managed-business-name">Business name</Label>
          <Input
            id="managed-business-name"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            placeholder="Memorial Stones Ltd"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="managed-business-email">Business email</Label>
          <Input
            id="managed-business-email"
            type="email"
            value={businessEmail}
            onChange={(e) => setBusinessEmail(e.target.value)}
            required
            placeholder="hello@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="managed-business-phone">Business phone</Label>
          <Input
            id="managed-business-phone"
            type="tel"
            value={businessPhone}
            onChange={(e) => setBusinessPhone(e.target.value)}
            required
            placeholder="+44..."
          />
        </div>
        {managedSubmitMutation.isError && (
          <p className="text-sm text-destructive">
            {managedSubmitMutation.error instanceof Error
              ? managedSubmitMutation.error.message
              : 'Submission failed. Please try again.'}
          </p>
        )}
        <DialogFooter>
          <Button type="submit" disabled={!isValid || managedSubmitMutation.isPending}>
            {managedSubmitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : isActionRequired ? (
              'Re-submit'
            ) : (
              'Submit'
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function PendingScreen({ onClose }: { onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Pending Provider Review</DialogTitle>
        <DialogDescription>Your details have been submitted.</DialogDescription>
      </DialogHeader>
      <div className="py-4 flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-xs">
          We're waiting for WhatsApp provider confirmation. This may take a few minutes — your
          connection status will update automatically.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

function ConnectedScreen({
  connectionId,
  onClose,
}: {
  connectionId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const managedDisconnectMutation = useManagedWhatsAppDisconnect();

  const handleDisconnect = () => {
    managedDisconnectMutation.mutate(connectionId, {
      onError: (err) =>
        toast({
          title: 'Could not disconnect',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        }),
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>WhatsApp Connected</DialogTitle>
        <DialogDescription>Your managed WhatsApp connection is active.</DialogDescription>
      </DialogHeader>
      <div className="py-4 flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          Provider-assigned number
        </Badge>
        <p className="text-xs text-muted-foreground max-w-xs">
          Your WhatsApp number was assigned by the provider. Inbound and outbound messaging is
          active.
        </p>
      </div>
      <DialogFooter>
        <Button
          variant="destructive"
          onClick={handleDisconnect}
          disabled={managedDisconnectMutation.isPending}
        >
          {managedDisconnectMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Disconnecting…
            </>
          ) : (
            'Disconnect'
          )}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

function FailedScreen({
  reasonMessage,
  onClose,
}: {
  reasonMessage?: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const managedStartMutation = useManagedWhatsAppStart();

  const handleStartOver = () => {
    managedStartMutation.mutate(undefined, {
      onError: (err) =>
        toast({
          title: 'Could not restart onboarding',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        }),
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Onboarding Failed</DialogTitle>
        <DialogDescription>
          {reasonMessage ?? 'Something went wrong during provider setup.'}
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-xs">
          You can start the onboarding process again. Your previous details will not be carried over.
        </p>
      </div>
      {managedStartMutation.isError && (
        <p className="text-sm text-destructive text-center">
          {managedStartMutation.error instanceof Error
            ? managedStartMutation.error.message
            : 'Failed to restart. Please try again.'}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleStartOver} disabled={managedStartMutation.isPending}>
          {managedStartMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting…
            </>
          ) : (
            'Start Over'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

function DisconnectedScreen({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const managedStartMutation = useManagedWhatsAppStart();

  const handleStartNew = () => {
    managedStartMutation.mutate(undefined, {
      onError: (err) =>
        toast({
          title: 'Could not start onboarding',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        }),
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>WhatsApp Disconnected</DialogTitle>
        <DialogDescription>
          Your WhatsApp connection has been disconnected. Past conversations remain visible.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 flex flex-col items-center gap-3 text-center">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-xs">
          You can start a new onboarding to reconnect.
        </p>
      </div>
      {managedStartMutation.isError && (
        <p className="text-sm text-destructive text-center">
          {managedStartMutation.error instanceof Error
            ? managedStartMutation.error.message
            : 'Failed to start. Please try again.'}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={handleStartNew} disabled={managedStartMutation.isPending}>
          {managedStartMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting…
            </>
          ) : (
            'Start New Onboarding'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

export const ManagedWhatsAppModal: React.FC<ManagedWhatsAppModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { data: managedStatus } = useManagedWhatsAppStatus();
  const { data: managedMeta, isLoading: isMetaLoading } = useManagedWhatsAppMeta(
    open && managedStatus?.status === 'action_required',
  );

  const managedConnected =
    managedStatus?.status === 'connected' &&
    Boolean(managedStatus.connected_requirements?.provider_ready) &&
    Boolean(managedStatus.connected_requirements?.has_account_sid) &&
    (Boolean(managedStatus.connected_requirements?.has_sender_sid) ||
      Boolean(managedStatus.connected_requirements?.has_from_address));

  const step = deriveModalStep(managedStatus, managedConnected);

  const handleClose = () => onOpenChange(false);

  const renderContent = () => {
    switch (step) {
      case 'start':
        return <StartScreen onClose={handleClose} />;

      case 'business_form':
        return (
          <BusinessFormScreen
            connectionId={managedStatus?.connection_id ?? ''}
            initialValues={null}
            isActionRequired={false}
          />
        );

      case 'pending':
        return <PendingScreen onClose={handleClose} />;

      case 'action_required':
        return isMetaLoading ? (
          <>
            <DialogHeader>
              <DialogTitle>Action Required</DialogTitle>
              <DialogDescription>Loading your previous details…</DialogDescription>
            </DialogHeader>
            <div className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : (
          <BusinessFormScreen
            connectionId={managedStatus?.connection_id ?? ''}
            initialValues={managedMeta}
            isActionRequired
            reasonMessage={managedStatus?.status_reason_message}
          />
        );

      case 'failed':
        return (
          <FailedScreen
            reasonMessage={managedStatus?.status_reason_message}
            onClose={handleClose}
          />
        );

      case 'connected':
        return (
          <ConnectedScreen
            connectionId={managedStatus?.connection_id ?? ''}
            onClose={handleClose}
          />
        );

      case 'disconnected':
        return <DisconnectedScreen onClose={handleClose} />;

      default:
        return <StartScreen onClose={handleClose} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
