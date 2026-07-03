import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { Link2, RefreshCw, Unlink, ChevronDown } from 'lucide-react';
import { useGmailConnection, useGmailConnect, useGmailDisconnect } from '../hooks/useGmailConnection';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';

interface GmailConnectionStatusProps {
  /** Cosmetic gate only — the connect/disconnect edge functions enforce admin server-side. */
  isAdmin?: boolean;
}

export const GmailConnectionStatus: React.FC<GmailConnectionStatusProps> = ({ isAdmin = false }) => {
  const { data: connection, isLoading, isError } = useGmailConnection();
  const connectMutation = useGmailConnect();
  const disconnectMutation = useGmailDisconnect();
  const { toast } = useToast();
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  const handleConnect = () => {
    connectMutation.mutate(undefined, {
      onError: (err) => {
        toast({
          title: 'Could not start Gmail connect',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => toast({ title: 'Gmail disconnected', description: 'Past conversations remain visible.' }),
      onError: (err) => {
        toast({
          title: 'Could not disconnect Gmail',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  const active = connection?.status === 'active';
  const revoked = connection?.status === 'revoked';
  const dotColor = active ? 'bg-gardens-grn' : revoked ? 'bg-gardens-amb' : 'bg-gardens-red';
  const statusLabel = active ? 'Connected' : revoked ? 'Reconnect required' : 'Not connected';

  if (!isAdmin) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'shrink-0 h-8 gap-1.5 px-2 sm:px-2.5 text-xs font-normal',
          'border border-border/60 rounded-full hover:bg-muted/60',
          (isLoading || isError) && 'opacity-70'
        )}
        disabled
        title={revoked ? 'The Gmail connection has expired. An organisation admin needs to reconnect it.' : undefined}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            isLoading ? 'bg-muted-foreground/50 animate-pulse' : dotColor
          )}
          aria-hidden
        />
        <span>Gmail</span>
        <span className="text-muted-foreground">{statusLabel}</span>
      </Button>
    );
  }

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
            <span>Gmail</span>
            {revoked && <span className="text-gardens-amb-dk">Reconnect required</span>}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px] max-w-[300px]">
          <div className="px-2 py-1.5 text-sm">
            <div className="font-medium">Status: {statusLabel}</div>
            {connection?.email_address && (
              <div className="text-muted-foreground text-xs mt-0.5 truncate">
                Account: {connection.email_address}
              </div>
            )}
            {active && (
              <div className="text-muted-foreground text-xs mt-0.5">
                Last synced: {connection?.last_synced_at
                  ? new Date(connection.last_synced_at).toLocaleString()
                  : 'never'}
              </div>
            )}
            {revoked && (
              <div className="text-muted-foreground text-xs mt-0.5">
                The Gmail connection has expired. Email will not sync or send until an admin
                reconnects it.
              </div>
            )}
          </div>
          <DropdownMenuSeparator />
          {active ? (
            <>
              <DropdownMenuItem
                onClick={handleConnect}
                disabled={connectMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Replace
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmDisconnectOpen(true)}
                disabled={disconnectMutation.isPending}
              >
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onClick={handleConnect}
              disabled={connectMutation.isPending}
            >
              <Link2 className="h-4 w-4 mr-2" />
              {revoked ? 'Reconnect' : 'Connect'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
            <AlertDialogDescription>
              This disconnects{' '}
              <strong>{connection?.email_address ?? 'the connected mailbox'}</strong> from this
              organisation. Email will stop syncing and sending until an admin reconnects. Past
              conversations remain visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
              className="bg-gardens-red hover:bg-gardens-red-dk"
            >
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
