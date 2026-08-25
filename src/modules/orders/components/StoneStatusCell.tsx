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

type StoneStatus = Order['stone_status'];

export const STONE_STATUSES: StoneStatus[] = ['NA', 'Ordered', 'In Stock'];

// Stone-only slice of the module-private badge helpers in orderColumnDefinitions.tsx,
// duplicated because importing from there would be circular (it imports this cell).
const getStoneVariant = (status: string): 'green' | 'blue' | 'grey' => {
  switch (status) {
    case 'In Stock': return 'green';
    case 'Ordered': return 'blue';
    default: return 'grey';
  }
};

const formatStoneLabel = (status: string): string =>
  status === 'In Stock' ? 'In stock' : status;

export const StoneStatusCell: React.FC<{ order: UIOrder }> = ({ order }) => {
  const { mutate: updateOrder, isPending } = useUpdateOrder();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button
          type="button"
          className="rounded focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge variant={getStoneVariant(order.stoneStatus)}>
            {formatStoneLabel(order.stoneStatus)}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {STONE_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={(e) => {
              e.stopPropagation();
              if (status !== order.stoneStatus) {
                updateOrder({ id: order.id, updates: { stone_status: status } });
              }
            }}
          >
            <Check
              className={cn(
                'mr-2 h-4 w-4',
                status === order.stoneStatus ? 'opacity-100' : 'opacity-0'
              )}
            />
            {formatStoneLabel(status)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
