import React from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { useUpdateOrder } from '../hooks/useOrders';
import type { UIOrder } from '../utils/orderTransform';
import { PROOF_STATUSES, formatProofLabel, getProofVariant } from '../utils/proofStatus';

export const ProofStatusCell: React.FC<{ order: UIOrder }> = ({ order }) => {
  const { mutate: updateOrder, isPending } = useUpdateOrder();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button
          type="button"
          className="rounded focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge variant={getProofVariant(order.proofStatus)}>
            {formatProofLabel(order.proofStatus)}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {PROOF_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={(e) => {
              e.stopPropagation();
              if (status !== order.proofStatus) {
                updateOrder({ id: order.id, updates: { proof_status: status } });
              }
            }}
          >
            <Check
              className={cn(
                'mr-2 h-4 w-4',
                status === order.proofStatus ? 'opacity-100' : 'opacity-0'
              )}
            />
            {formatProofLabel(status)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
