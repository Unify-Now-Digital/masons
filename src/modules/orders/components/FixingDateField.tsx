/**
 * Editable fixing (installation) date for the order side panel. Stored in
 * orders.installation_date — the existing column is the fixing date (15 Oct 2026).
 */
import React, { useEffect, useState } from 'react';
import { useUpdateOrder } from '../hooks/useOrders';
import { useToast } from '@/shared/hooks/use-toast';

export const FixingDateField: React.FC<{ orderId: string; value: string | null | undefined }> = ({ orderId, value }) => {
  const [draft, setDraft] = useState(value ?? '');
  const update = useUpdateOrder();
  const { toast } = useToast();
  useEffect(() => setDraft(value ?? ''), [value]);

  const save = (next: string) => {
    if ((value ?? '') === next) return;
    update.mutate(
      { id: orderId, updates: { installation_date: next || null } },
      {
        onSuccess: () => toast({ title: next ? 'Fixing date saved' : 'Fixing date cleared' }),
        onError: (e) => {
          setDraft(value ?? '');
          toast({ title: 'Could not save the fixing date', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
        },
      },
    );
  };

  return (
    <input
      type="date"
      aria-label="Fixing date"
      data-testid="fixing-date-input"
      className="h-8 rounded-md border border-gardens-bdr bg-white px-2 text-[13px] disabled:opacity-60"
      value={draft}
      disabled={update.isPending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => save(e.target.value)}
    />
  );
};
