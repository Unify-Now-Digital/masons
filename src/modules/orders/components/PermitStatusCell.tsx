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
import type { Order } from '../types/orders.types';

type PermitStatus = Order['permit_status'];

export const PERMIT_STATUSES: PermitStatus[] = ['not_started', 'form_sent', 'customer_completed', 'pending', 'approved'];

// Permit-only slice of the module-private badge helpers in orderColumnDefinitions.tsx,
// duplicated because importing from there would be circular (it imports this cell).
const getPermitVariant = (status: string): 'green' | 'amber' | 'blue' | 'grey' => {
  switch (status) {
    case 'approved': return 'green';
    case 'pending': return 'amber';
    case 'form_sent': case 'customer_completed': return 'blue';
    default: return 'grey';
  }
};

const formatPermitLabel = (status: string): string => {
  switch (status) {
    case 'form_sent': return 'Form sent';
    case 'customer_completed': return 'Customer done';
    default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
};

export const PermitStatusCell: React.FC<{ order: UIOrder }> = ({ order }) => {
  const { mutate: updateOrder, isPending } = useUpdateOrder();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button
          type="button"
          className="rounded focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge variant={getPermitVariant(order.permitStatus)}>
            {formatPermitLabel(order.permitStatus)}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {PERMIT_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={(e) => {
              e.stopPropagation();
              if (status !== order.permitStatus) {
                updateOrder({ id: order.id, updates: { permit_status: status } });
              }
            }}
          >
            <Check
              className={cn(
                'mr-2 h-4 w-4',
                status === order.permitStatus ? 'opacity-100' : 'opacity-0'
              )}
            />
            {formatPermitLabel(status)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
