import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrderExtrasList, useDismissExtra, useAddExtraToInvoice, orderExtrasKeys } from '../hooks/useOrderExtras';
import { ExtrasCard } from './ExtrasCard';
import { detectOrderExtras } from '../api/extras.api';

export function ExtrasTab() {
  const { data: extras, isLoading } = useOrderExtrasList('pending');
  const dismissMutation = useDismissExtra();
  const addToInvoiceMutation = useAddExtraToInvoice();
  const queryClient = useQueryClient();

  const scanMutation = useMutation({
    mutationFn: () => detectOrderExtras(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderExtrasKeys.all });
    },
  });

  const handleAddToInvoice = (extraId: string, amount: number) => {
    addToInvoiceMutation.mutate({
      extraId,
      amount,
      actionedBy: 'user', // TODO: replace with actual user name
    });
  };

  const handleDismiss = (extraId: string) => {
    dismissMutation.mutate({
      extraId,
      dismissedBy: 'user', // TODO: replace with actual user name
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            AI-flagged changes from customer conversations that may need to be added to the final invoice.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          {scanMutation.isPending ? 'Scanning...' : 'Scan conversations'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !extras?.length ? (
        <div className="text-sm text-muted-foreground text-center py-8 bg-muted/50 border rounded-md">
          No pending extras detected. Click "Scan conversations" to check for recent changes.
        </div>
      ) : (
        <div className="space-y-3">
          {extras.map((extra) => (
            <ExtrasCard
              key={extra.id}
              extra={extra}
              onAddToInvoice={handleAddToInvoice}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
