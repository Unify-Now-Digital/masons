import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { Link2, RefreshCw, Unlink, ChevronDown } from 'lucide-react';
import { useGmailConnection, useGmailConnect, useGmailDisconnect } from '../hooks/useGmailConnection';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';

export const GmailConnectionStatus: React.FC = () => {
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
      onSuccess: () => toast({ title: 'Gmail disconnected' }),
      onError: (err) => {
        toast({
          title: 'Could not disconnect Gmail',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  const connected = !!connection;
  const dotColor = connected ? 'bg-gardens-grn' : 'bg-gardens-red';

  return (
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
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium">
            Status: {connected ? 'Connected' : 'Not connected'}
          </div>
          {connected && (
            <div className="text-muted-foreground text-xs mt-0.5 truncate">
              Account: {connection.email_address ?? 'Unknown'}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        {connected ? (
          <>
            <DropdownMenuItem
              onClick={handleConnect}
              disabled={connectMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Replace
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDisconnect}
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
            Connect
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
