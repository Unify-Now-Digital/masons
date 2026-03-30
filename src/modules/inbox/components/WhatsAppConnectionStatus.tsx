import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Link2, RefreshCw, Unlink, ChevronDown, MessageCircle } from 'lucide-react';
import {
  useWhatsAppConnection,
  useWhatsAppConnect,
  useWhatsAppDisconnect,
  useManagedWhatsAppStatus,
  usePreferredWhatsAppMode,
  useSetPreferredWhatsAppMode,
  useWhatsAppTest,
} from '../hooks/useWhatsAppConnection';
import { ManagedWhatsAppModal, getManagedMenuLabel } from './ManagedWhatsAppModal';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';

export const WhatsAppConnectionStatus: React.FC = () => {
  const { data: connection, isLoading, isError } = useWhatsAppConnection();
  const connectMutation = useWhatsAppConnect();
  const disconnectMutation = useWhatsAppDisconnect();
  const testMutation = useWhatsAppTest();
  const { data: preferredMode = 'manual' } = usePreferredWhatsAppMode();
  const setModeMutation = useSetPreferredWhatsAppMode();
  const { data: managedStatus } = useManagedWhatsAppStatus();
  const { toast } = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [managedModalOpen, setManagedModalOpen] = useState(false);
  const [formSid, setFormSid] = useState('');
  const [formKeySid, setFormKeySid] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formFrom, setFormFrom] = useState('');

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate(
      {
        twilio_account_sid: formSid,
        twilio_api_key_sid: formKeySid,
        twilio_api_key_secret: formSecret,
        whatsapp_from: formFrom,
      },
      {
        onSuccess: () => {
          toast({ title: 'WhatsApp connected' });
          setConnectOpen(false);
          setFormSid('');
          setFormKeySid('');
          setFormSecret('');
          setFormFrom('');
        },
        onError: (err) => {
          toast({
            title: 'Could not connect WhatsApp',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => toast({ title: 'WhatsApp disconnected. Past conversations remain visible.' }),
      onError: (err) => {
        toast({
          title: 'Could not disconnect',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  const handleTest = () => {
    testMutation.mutate(undefined, {
      onSuccess: () => toast({ title: 'Test message sent' }),
      onError: (err) => {
        toast({
          title: 'Test failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  const connected = connection?.status === 'connected';
  const managedConnected =
    managedStatus?.status === 'connected' &&
    Boolean(managedStatus.connected_requirements?.provider_ready) &&
    Boolean(managedStatus.connected_requirements?.has_account_sid) &&
    (Boolean(managedStatus.connected_requirements?.has_sender_sid) ||
      Boolean(managedStatus.connected_requirements?.has_from_address));
  const effectiveConnected = preferredMode === 'managed' ? managedConnected : connected;
  const managedStatusLabel = managedStatus?.status
    ? managedStatus.status.replaceAll('_', ' ')
    : 'not started';
  const dotColor =
    preferredMode === 'managed'
      ? managedConnected
        ? 'bg-green-500'
        : managedStatus?.status === 'failed'
          ? 'bg-amber-500'
          : 'bg-red-500'
      : connection?.status === 'error'
        ? 'bg-amber-500'
        : connected
          ? 'bg-green-500'
          : 'bg-red-500';

  const switchMode = (mode: 'manual' | 'managed') => {
    setModeMutation.mutate(mode, {
      onSuccess: () => {
        toast({
          title: `WhatsApp mode set to ${mode}`,
          description:
            mode === 'managed'
              ? 'Managed sends will be blocked until provider status is connected.'
              : 'Manual Twilio credential flow is active.',
        });
      },
      onError: (err) => {
        toast({
          title: 'Could not switch mode',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'shrink-0 h-8 gap-1.5 px-2 sm:px-2.5 text-xs font-normal',
              'border border-border/60 rounded-full hover:bg-muted/60',
              (isLoading || isError) && 'opacity-70'
            )}
            disabled={isLoading}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                isLoading ? 'bg-muted-foreground/50 animate-pulse' : dotColor
              )}
              aria-hidden
            />
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">WhatsApp</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <div className="px-2 py-1.5 text-sm">
            <div className="font-medium">
              Status:{' '}
              {preferredMode === 'managed'
                ? (effectiveConnected ? 'Connected' : managedStatusLabel)
                : (connected ? 'Connected' : connection?.status === 'error' ? 'Error' : 'Not connected')}
            </div>
            <div className="text-muted-foreground text-xs mt-0.5">Mode: {preferredMode}</div>
            {connection?.status === 'error' && connection?.last_error && (
              <div className="text-muted-foreground text-xs mt-0.5">{connection.last_error}</div>
            )}
            {preferredMode === 'managed' && managedStatus?.status_reason_message && !managedConnected && (
              <div className="text-muted-foreground text-xs mt-0.5">{managedStatus.status_reason_message}</div>
            )}
            {preferredMode === 'manual' && connected && connection?.whatsapp_from && (
              <div className="text-muted-foreground text-xs mt-0.5 truncate">
                Sender: {connection.whatsapp_from}
              </div>
            )}
            {preferredMode === 'managed' && managedConnected && (
              <div className="text-muted-foreground text-xs mt-0.5">Managed sender is provider-ready.</div>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => switchMode('manual')} disabled={setModeMutation.isPending || preferredMode === 'manual'}>
            Use manual mode
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => switchMode('managed')} disabled={setModeMutation.isPending || preferredMode === 'managed'}>
            Use managed mode
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {preferredMode === 'manual' ? (
            connected ? (
            <>
              <DropdownMenuItem onClick={handleTest} disabled={testMutation.isPending}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Test
              </DropdownMenuItem>
              <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Replace
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle>Replace WhatsApp connection</DialogTitle>
                    <DialogDescription>
                      Enter new Twilio credentials. Your previous connection will be disconnected.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleConnectSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="wa-account-sid">Account SID</Label>
                      <Input
                        id="wa-account-sid"
                        value={formSid}
                        onChange={(e) => setFormSid(e.target.value)}
                        placeholder="AC..."
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa-api-key-sid">API Key SID</Label>
                      <Input
                        id="wa-api-key-sid"
                        value={formKeySid}
                        onChange={(e) => setFormKeySid(e.target.value)}
                        placeholder="SK..."
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa-api-key-secret">API Key Secret</Label>
                      <Input
                        id="wa-api-key-secret"
                        type="password"
                        value={formSecret}
                        onChange={(e) => setFormSecret(e.target.value)}
                        placeholder="Secret"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa-from">WhatsApp From (E.164)</Label>
                      <Input
                        id="wa-from"
                        value={formFrom}
                        onChange={(e) => setFormFrom(e.target.value)}
                        placeholder="+44..."
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={connectMutation.isPending}>
                        {connectMutation.isPending ? 'Connecting…' : 'Replace'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <DropdownMenuItem
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
              >
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </DropdownMenuItem>
            </>
            ) : (
            <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Connect WhatsApp</DialogTitle>
                  <DialogDescription>
                    Enter your Twilio credentials. Use Sandbox or production WhatsApp-enabled number.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleConnectSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wa-account-sid-new">Account SID</Label>
                    <Input
                      id="wa-account-sid-new"
                      value={formSid}
                      onChange={(e) => setFormSid(e.target.value)}
                      placeholder="AC..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-api-key-sid-new">API Key SID</Label>
                    <Input
                      id="wa-api-key-sid-new"
                      value={formKeySid}
                      onChange={(e) => setFormKeySid(e.target.value)}
                      placeholder="SK..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-api-key-secret-new">API Key Secret</Label>
                    <Input
                      id="wa-api-key-secret-new"
                      type="password"
                      value={formSecret}
                      onChange={(e) => setFormSecret(e.target.value)}
                      placeholder="Secret"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-from-new">WhatsApp From (E.164)</Label>
                    <Input
                      id="wa-from-new"
                      value={formFrom}
                      onChange={(e) => setFormFrom(e.target.value)}
                      placeholder="+44..."
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={connectMutation.isPending}>
                      {connectMutation.isPending ? 'Connecting…' : 'Connect'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )
          ) : (
            <>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setManagedModalOpen(true); }}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {getManagedMenuLabel(managedStatus?.status, managedStatus?.exists ?? false)}
              </DropdownMenuItem>
              {!managedConnected && managedStatus?.status && managedStatus.status !== 'draft' && (
                <DropdownMenuItem disabled>
                  Send blocked until managed status is connected
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ManagedWhatsAppModal open={managedModalOpen} onOpenChange={setManagedModalOpen} />
    </>
  );
};
