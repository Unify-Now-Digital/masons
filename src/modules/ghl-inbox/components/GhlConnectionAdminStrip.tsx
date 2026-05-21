import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
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
import { useToast } from '@/shared/hooks/use-toast';
import type { GhlConnectionRow } from '../api/ghlInbox.api';
import { useDisconnectGhlConnection } from '../hooks/useGhlConnection';

function maskLocationId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function formatVerified(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

type Props = {
  connection: GhlConnectionRow;
};

export const GhlConnectionAdminStrip: React.FC<Props> = ({ connection }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const disconnect = useDisconnectGhlConnection();

  const onDisconnect = () => {
    disconnect.mutate(connection, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast({ title: 'GHL connection disconnected' });
      },
      onError: (err) => {
        toast({
          title: 'Disconnect failed',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-4 py-2 text-sm">
        <span>
          Status: <strong className="capitalize">{connection.status}</strong>
        </span>
        <span className="text-muted-foreground">
          Location: <span className="font-mono">{maskLocationId(connection.ghl_location_id)}</span>
        </span>
        <span className="text-muted-foreground">
          Last verified: {formatVerified(connection.last_verified_at)}
        </span>
        {connection.status === 'active' && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="ml-auto"
            onClick={() => setConfirmOpen(true)}
            disabled={disconnect.isPending}
          >
            Disconnect
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GoHighLevel?</AlertDialogTitle>
            <AlertDialogDescription>
              Members will no longer see live GHL conversations until an administrator reconnects
              the location (pilot: via database seed).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDisconnect} disabled={disconnect.isPending}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
