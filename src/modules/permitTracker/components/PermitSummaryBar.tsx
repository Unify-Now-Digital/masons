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
    { label: 'Action needed', count: counts.action_needed, color: 'bg-red-100 text-red-800 border-red-200' },
    { label: 'Chase this week', count: counts.chase_this_week, color: 'bg-amber-100 text-amber-800 border-amber-200' },
    { label: 'Awaiting customer', count: counts.awaiting_customer, color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { label: 'On track', count: counts.on_track, color: 'bg-gray-100 text-gray-700 border-gray-200' },
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
