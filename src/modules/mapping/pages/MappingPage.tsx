import React, { useMemo, useState, useCallback } from 'react';
import { Loader2, Sparkles, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog';
import { UkJobsMap } from '../components/UkJobsMap';
import { SchedulingPanel } from '../components/SchedulingPanel';
import {
  useSchedulableOrders,
  useUpdateInstallationDates,
} from '../hooks/useSchedulableOrders';
import { autoSchedule } from '../utils/autoSchedule';

export const MappingPage: React.FC = () => {
  const { data: orders = [], isLoading } = useSchedulableOrders();
  const updateMutation = useUpdateInstallationDates();
  const { toast } = useToast();

  // Local override of installation_date for unsaved planning. Falls back to
  // the persisted order.installation_date when the order is not in the map.
  const [draft, setDraft] = useState<Map<string, string | null>>(new Map());
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  const scheduledDates = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const o of orders) {
      const override = draft.get(o.id);
      if (draft.has(o.id)) {
        map.set(o.id, override);
      } else {
        map.set(o.id, o.installation_date);
      }
    }
    return map;
  }, [orders, draft]);

  const dirty = draft.size > 0;
  const handleAssign = useCallback((orderId: string, date: string) => {
    setDraft((prev) => {
      const next = new Map(prev);
      next.set(orderId, date);
      return next;
    });
  }, []);

  const handleUnassign = useCallback((orderId: string) => {
    setDraft((prev) => {
      const next = new Map(prev);
      next.set(orderId, null);
      return next;
    });
  }, []);

  const handleAutoSchedule = useCallback(() => {
    const proposed = autoSchedule(orders);
    setDraft(() => {
      const next = new Map<string, string | null>();
      const seen = new Set<string>();
      for (const day of proposed) {
        for (const orderId of day.orderIds) {
          next.set(orderId, day.date);
          seen.add(orderId);
        }
      }
      // Mark every order not landed by the algorithm as explicitly unscheduled
      // (e.g. missing coordinates) so saving wipes any stale date.
      for (const o of orders) {
        if (!seen.has(o.id)) next.set(o.id, null);
      }
      return next;
    });
  }, [orders]);

  const handleClearDraft = useCallback(() => {
    setDraft(new Map());
  }, []);

  const handleSave = useCallback(async () => {
    const byDate = new Map<string | null, string[]>();
    for (const [orderId, date] of draft.entries()) {
      const original = orders.find((o) => o.id === orderId)?.installation_date ?? null;
      if (original === date) continue; // No-op
      const list = byDate.get(date) ?? [];
      list.push(orderId);
      byDate.set(date, list);
    }
    if (byDate.size === 0) {
      toast({ title: 'Nothing to save', description: 'No changes pending.' });
      return;
    }
    try {
      for (const [date, ids] of byDate.entries()) {
        await updateMutation.mutateAsync({ date, orderIds: ids });
      }
      setDraft(new Map());
      toast({ title: 'Schedule saved', description: 'Installation dates updated.' });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      });
    }
  }, [draft, orders, updateMutation, toast]);

  const handleMarkerClick = useCallback((orderId: string) => {
    setHighlightedOrderId((prev) => (prev === orderId ? null : orderId));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-zinc-200 bg-white">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Mapping & Scheduling</h1>
          <p className="text-xs text-zinc-500">
            Lettered, approved, and in-stock jobs across the UK — auto-grouped by site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoSchedule}
            disabled={isLoading || orders.length === 0}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Auto-schedule
          </Button>
          {dirty && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Discard
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard schedule changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Unsaved date assignments will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearDraft}>
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[2fr_1fr] min-h-0">
        <div className="relative bg-zinc-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : (
            <UkJobsMap
              orders={orders}
              scheduledDates={scheduledDates}
              highlightedOrderId={highlightedOrderId}
              onMarkerClick={handleMarkerClick}
            />
          )}
        </div>
        <div className="border-l border-zinc-200 min-h-0">
          <SchedulingPanel
            orders={orders}
            scheduledDates={scheduledDates}
            highlightedOrderId={highlightedOrderId}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            onHover={setHighlightedOrderId}
          />
        </div>
      </div>
    </div>
  );
};
