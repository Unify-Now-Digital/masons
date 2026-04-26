import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { ChevronDown, ChevronRight, Mail } from 'lucide-react';
import type { PermitOrder, CemeteryGroup } from '../types/permitTracker.types';
import { getPermitDays, getOrderSection } from '../utils/permitDays';
import { PermitCard } from './PermitCard';

interface CemeteryGroupViewProps {
  orders: PermitOrder[];
  onChaseMulti: (orders: PermitOrder[]) => void;
  onChaseSingle: (order: PermitOrder, target: 'cemetery' | 'customer') => void;
  onLogNote: (order: PermitOrder) => void;
}

function buildCemeteryGroups(orders: PermitOrder[]): CemeteryGroup[] {
  const map = new Map<string, CemeteryGroup>();

  for (const order of orders) {
    const key = order.cemetery_id ?? order.location ?? 'unknown';
    const cemeteryName = order.cemetery?.name ?? order.location ?? 'Unknown cemetery';

    if (!map.has(key)) {
      map.set(key, {
        cemetery: order.cemetery,
        cemeteryName,
        orders: [],
        overdueCount: 0,
        chasingCount: 0,
        onTrackCount: 0,
      });
    }

    const group = map.get(key)!;
    group.orders.push(order);

    const section = getOrderSection(order);
    if (section === 'action_needed') group.overdueCount++;
    else if (section === 'chase_this_week') group.chasingCount++;
    else group.onTrackCount++;
  }

  // Sort groups: most overdue first
  return Array.from(map.values()).sort(
    (a, b) => b.overdueCount - a.overdueCount || b.chasingCount - a.chasingCount
  );
}

export function CemeteryGroupView({
  orders,
  onChaseMulti,
  onChaseSingle,
  onLogNote,
}: CemeteryGroupViewProps) {
  const groups = buildCemeteryGroups(orders);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.cemeteryName))
  );

  function toggleGroup(name: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No active permit applications.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isOpen = openGroups.has(group.cemeteryName);
        const email = group.cemetery?.primary_email;

        // Sort orders within group by days descending
        const sortedOrders = [...group.orders].sort(
          (a, b) => getPermitDays(b) - getPermitDays(a)
        );

        // Only show chase button for pending/customer_completed orders (not form_sent)
        const chaseable = sortedOrders.filter(
          (o) => o.permit_status === 'pending' || o.permit_status === 'customer_completed'
        );

        return (
          <Card key={group.cemeteryName} className="overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.cemeteryName)}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{group.cemeteryName}</span>
                      {email && (
                        <span className="text-xs text-muted-foreground ml-2">{email}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {group.overdueCount > 0 && (
                      <Badge variant="outline" className="bg-gardens-red-lt text-gardens-red-dk border-gardens-red-lt text-xs">
                        {group.overdueCount} overdue
                      </Badge>
                    )}
                    {group.chasingCount > 0 && (
                      <Badge variant="outline" className="bg-gardens-amb-lt text-gardens-amb-dk border-gardens-amb-lt text-xs">
                        {group.chasingCount} chasing
                      </Badge>
                    )}
                    {group.onTrackCount > 0 && (
                      <Badge variant="outline" className="bg-gardens-page text-gardens-tx border-gardens-bdr text-xs">
                        {group.onTrackCount} on track
                      </Badge>
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t px-4 pb-4 pt-3 space-y-2">
                  {chaseable.length > 0 && (
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChaseMulti(chaseable);
                        }}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Chase {group.cemeteryName}
                      </Button>
                    </div>
                  )}

                  {sortedOrders.map((order) => (
                    <PermitCard
                      key={order.id}
                      order={order}
                      section={getOrderSection(order)}
                      onChase={onChaseSingle}
                      onLogNote={onLogNote}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
