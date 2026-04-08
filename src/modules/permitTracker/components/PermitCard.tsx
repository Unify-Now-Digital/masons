import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Mail, FileText, MessageSquare } from 'lucide-react';
import type { PermitOrder, PermitSection } from '../types/permitTracker.types';
import { getPermitDays, getDayBadgeColor } from '../utils/permitDays';

interface PermitCardProps {
  order: PermitOrder;
  section: PermitSection;
  onChase: (order: PermitOrder, target: 'cemetery' | 'customer') => void;
  onLogNote: (order: PermitOrder) => void;
}

const SECTION_BORDER: Record<PermitSection, string> = {
  action_needed: 'border-l-red-500',
  chase_this_week: 'border-l-amber-500',
  awaiting_customer: 'border-l-blue-500',
  on_track: 'border-l-gray-400',
};

export function PermitCard({ order, section, onChase, onLogNote }: PermitCardProps) {
  const days = getPermitDays(order);
  const dayBadgeColor = getDayBadgeColor(days);
  const borderColor = SECTION_BORDER[section];

  const orderRef = order.order_number
    ? `ORD-${String(order.order_number).padStart(4, '0')}`
    : order.id.slice(0, 8);

  const cemeteryName = order.cemetery?.name ?? order.location ?? 'Unknown cemetery';
  const deceasedName = order.person_name ?? order.deceased_name ?? '—';
  const memorialType = order.memorial_type ?? order.order_type ?? '—';

  return (
    <Card className={`border-l-4 ${borderColor} p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">
              {order.customer_name}
            </span>
            <span className="text-xs text-muted-foreground">{orderRef}</span>
            <Badge variant="outline" className={`text-xs ${dayBadgeColor}`}>
              {days}d
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground truncate">
            {cemeteryName} · {memorialType} · {deceasedName}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {section === 'awaiting_customer' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onChase(order, 'customer')}
            >
              <Mail className="h-3 w-3 mr-1" />
              Chase customer
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onChase(order, 'cemetery')}
              >
                <Mail className="h-3 w-3 mr-1" />
                Chase cemetery
              </Button>
              {section === 'action_needed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onChase(order, 'customer')}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Draft customer request
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => onLogNote(order)}
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
