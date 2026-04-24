import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import type { PermitOrder } from '../types/permitTracker.types';
import { getOrderSection } from '../utils/permitDays';

interface PermitSummaryBarProps {
  orders: PermitOrder[];
}

export function PermitSummaryBar({ orders }: PermitSummaryBarProps) {
  const counts = { action_needed: 0, chase_this_week: 0, awaiting_customer: 0, on_track: 0 };

  for (const order of orders) {
    const section = getOrderSection(order);
    counts[section]++;
  }

  const chips: { label: string; count: number; color: string }[] = [
    { label: 'Action needed', count: counts.action_needed, color: 'bg-gardens-red-lt text-gardens-red-dk border-gardens-red-lt' },
    { label: 'Chase this week', count: counts.chase_this_week, color: 'bg-gardens-amb-lt text-gardens-amb-dk border-gardens-amb-lt' },
    { label: 'Awaiting customer', count: counts.awaiting_customer, color: 'bg-gardens-blu-lt text-gardens-blu-dk border-gardens-blu-lt' },
    { label: 'On track', count: counts.on_track, color: 'bg-gardens-page text-gardens-tx border-gardens-bdr' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Badge
          key={chip.label}
          variant="outline"
          className={`px-3 py-1.5 text-sm font-medium ${chip.color}`}
        >
          {chip.label}: {chip.count}
        </Badge>
      ))}
    </div>
  );
}
