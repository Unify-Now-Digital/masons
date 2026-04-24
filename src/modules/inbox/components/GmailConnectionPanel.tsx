import React from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Mail, Link2, Unlink, RefreshCw } from 'lucide-react';
import { useGmailConnection, useGmailConnect, useGmailDisconnect } from '../hooks/useGmailConnection';
import { useToast } from '@/shared/hooks/use-toast';

export const GmailConnectionPanel: React.FC = () => {
  const { data: connection, isLoading, isError } = useGmailConnection();
  const connectMutation = useGmailConnect();
  const disconnectMutation = useGmailDisconnect();
  const { toast } = useToast();

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
      onSuccess: () => {
        toast({ title: 'Gmail disconnected' });
      },
      onError: (err) => {
        toast({
          title: 'Could not disconnect Gmail',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Gmail
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gardens-txs">Checking connection…</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Gmail
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gardens-txs">Unable to load Gmail status.</p>
        </CardContent>
      </Card>
    );
  }

  if (!connection) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <span className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Gmail
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gardens-tx">No Gmail account connected. Connect to sync and send email from this inbox.</p>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={connectMutation.isPending}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Connect Gmail
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <span className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Gmail
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-gardens-tx">
          Connected as <strong>{connection.email_address ?? 'Unknown'}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleConnect}
            disabled={connectMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Replace
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
          >
            <Unlink className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
