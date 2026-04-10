import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrderExtrasList, useDismissExtra, useAddExtraToInvoice, orderExtrasKeys } from '../hooks/useOrderExtras';
import { ExtrasTable } from './ExtrasTable';
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          AI-flagged changes from customer conversations. Click a row to see the quote.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          {scanMutation.isPending ? 'Scanning...' : 'Scan conversations'}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <ExtrasTable
          extras={extras ?? []}
          onAddToInvoice={(extraId, amount) => {
            addToInvoiceMutation.mutate({ extraId, amount, actionedBy: 'user' });
          }}
          onDismiss={(extraId) => {
            dismissMutation.mutate({ extraId, dismissedBy: 'user' });
          }}
        />
      )}
    </div>
  );
}
