import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import {
  Loader2,
  Sparkles,
  RotateCcw,
  Save,
  ChevronsRight,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
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
import { UkJobsMap } from './UkJobsMap';
import { DayCard } from './DayCard';
import { UnscheduledList } from './UnscheduledList';
import {
  useScheduleData,
  useSaveSchedule,
} from '../../hooks/useScheduleData';
import { autoSchedule, shiftDateByWorkdays } from '../../utils/autoSchedule';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { useConfirmedOrderPins } from '../../hooks/useConfirmedOrderPins';
import { PermitPinLegend } from './PermitPinLegend';
import { hiddenOrderIds, type PermitPinStatus } from '../../utils/permitPins';
import { compose } from '../../utils/capacityRules';
import { OrderDetailsSidebar } from '@/modules/orders/components/OrderDetailsSidebar';
import { useOrder } from '@/modules/orders/hooks/useOrders';

const HORIZON_WEEKS = 2;
const WORKDAYS_PER_WEEK = 5;
const HORIZON_WORKDAYS = HORIZON_WEEKS * WORKDAYS_PER_WEEK;

function buildHorizonDates(start: Date, count: number): string[] {
  const out: string[] = [];
  let cursor = start;
  while (out.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) out.push(format(cursor, 'yyyy-MM-dd'));
    cursor = addDays(cursor, 1);
  }
  return out;
}

function summariseWeek(dates: string[], byDate: Map<string, ScheduleStop[]>) {
  let jobs = 0;
  let kerb = 0;
  let other = 0;
  let empty = 0;
  for (const date of dates) {
    const dayStops = byDate.get(date) ?? [];
    if (dayStops.length === 0) empty += 1;
    const c = compose(dayStops);
    jobs += c.total;
    kerb += c.kerb;
    other += c.other;
  }
  return { jobs, kerb, other, empty };
}

function groupByWeek(dates: string[]): { weekStart: string; dates: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const d of dates) {
    const ws = format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const list = groups.get(ws) ?? [];
    list.push(d);
    groups.set(ws, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, dates]) => ({ weekStart, dates }));
}

export const MapTab: React.FC = () => {
  const { data: stops = [], isLoading } = useScheduleData();
  const saveMutation = useSaveSchedule();
  const { toast } = useToast();

  // Confirmed-order pins at the cemetery, coloured by permit status.
  const [mapsReady, setMapsReady] = useState(false);
  const { pins: orderPins } = useConfirmedOrderPins(mapsReady);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<PermitPinStatus>>(new Set());
  const hiddenIds = useMemo(
    () => hiddenOrderIds(orderPins, hiddenStatuses),
    [orderPins, hiddenStatuses],
  );
  const visiblePins = useMemo(
    () => orderPins.filter((p) => !hiddenIds.has(p.orderId)),
    [orderPins, hiddenIds],
  );
  // Schedulable stops whose permit chip is switched off are hidden too, so a
  // filtered-out order never reappears as a plain scheduling marker.
  const mapStops = useMemo(
    () => stops.filter((s) => !hiddenIds.has(s.orderId)),
    [stops, hiddenIds],
  );
  const toggleStatus = useCallback((st: PermitPinStatus) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
  }, []);
  const [panelOrderId, setPanelOrderId] = useState<string | null>(null);
  const { data: panelOrder } = useOrder(panelOrderId ?? '');
  const handleMapsReady = useCallback(() => setMapsReady(true), []);

  // Draft scheduling state. Always present for every stop currently in view
  // so the map and side panel agree on what's where. Initialised from DB
  // values, then overwritten by auto-schedule and user actions.
  const [draftDates, setDraftDates] = useState<Map<string, string | null>>(new Map());
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [pinnedHighlightId, setPinnedHighlightId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const highlightedOrderId = hoveredOrderId ?? pinnedHighlightId;
  const [mobilePane, setMobilePane] = useState<'map' | 'list'>('map');
  const [savedBaseline, setSavedBaseline] = useState<Map<string, string | null>>(new Map());
  const [hasAutoProposed, setHasAutoProposed] = useState(false);

  const horizonDates = useMemo(() => buildHorizonDates(new Date(), HORIZON_WORKDAYS), []);
  const horizonWeeks = useMemo(() => groupByWeek(horizonDates), [horizonDates]);
  const horizonSet = useMemo(() => new Set(horizonDates), [horizonDates]);

  // Initial sync: when stops first load, capture the saved schedule as baseline,
  // pin every persistently-scheduled job (so re-optimisation doesn't move them),
  // and propose dates for the rest.
  useEffect(() => {
    if (stops.length === 0 || hasAutoProposed) return;
    const baseline = new Map<string, string | null>();
    const initialPins = new Set<string>();
    for (const s of stops) {
      baseline.set(s.orderId, s.scheduledDate);
      if (s.scheduledDate) initialPins.add(s.orderId);
    }
    setSavedBaseline(baseline);

    // Build pin map for autoSchedule (only those currently within horizon).
    const pinMap = new Map<string, string>();
    for (const s of stops) {
      if (s.scheduledDate && horizonSet.has(s.scheduledDate)) {
        pinMap.set(s.orderId, s.scheduledDate);
      }
    }
    const proposed = autoSchedule(stops, {
      pins: pinMap,
      horizonWorkdays: HORIZON_WORKDAYS,
    });
    setDraftDates(proposed);
    setPinned(initialPins);
    setHasAutoProposed(true);
  }, [stops, hasAutoProposed, horizonSet]);

  // Re-run autoSchedule with current pins. Used after manual moves, removals,
  // and the explicit "Re-run" button.
  const rerun = useCallback(
    (pins: Set<string>, overrides: Map<string, string | null> = new Map()) => {
      const pinMap = new Map<string, string>();
      for (const s of stops) {
        const draftDate = overrides.has(s.orderId)
          ? overrides.get(s.orderId)
          : draftDates.get(s.orderId);
        if (pins.has(s.orderId) && draftDate) {
          pinMap.set(s.orderId, draftDate);
        }
      }
      const proposed = autoSchedule(stops, {
        pins: pinMap,
        horizonWorkdays: HORIZON_WORKDAYS,
      });
      // Preserve pin dates exactly; only update non-pinned entries from proposal.
      setDraftDates((prev) => {
        const next = new Map(prev);
        for (const s of stops) {
          if (pins.has(s.orderId)) {
            const date = overrides.get(s.orderId) ?? prev.get(s.orderId) ?? null;
            next.set(s.orderId, date);
          } else {
            next.set(s.orderId, proposed.get(s.orderId) ?? null);
          }
        }
        return next;
      });
    },
    [stops, draftDates]
  );

  const undoSnapshotRef = useRef<{
    draftDates: Map<string, string | null>;
    pinned: Set<string>;
  } | null>(null);

  const captureUndoSnapshot = useCallback(() => {
    undoSnapshotRef.current = {
      draftDates: new Map(draftDates),
      pinned: new Set(pinned),
    };
  }, [draftDates, pinned]);

  const applyUndo = useCallback(() => {
    const snap = undoSnapshotRef.current;
    if (!snap) return;
    setDraftDates(snap.draftDates);
    setPinned(snap.pinned);
    undoSnapshotRef.current = null;
  }, []);

  const showRescheduleToast = useCallback(
    (movedCount: number) => {
      toast({
        title: `Re-optimised ${movedCount} job${movedCount === 1 ? '' : 's'}`,
        description: 'Pins were honoured and the rest filled around them.',
        action: (
          <button
            type="button"
            onClick={applyUndo}
            className="text-xs font-medium px-2 py-1 rounded border border-gardens-bdr hover:bg-gardens-page"
          >
            Undo
          </button>
        ),
      });
    },
    [toast, applyUndo]
  );

  const handleMoveTo = useCallback(
    (orderId: string, toDate: string) => {
      captureUndoSnapshot();
      const nextPins = new Set(pinned);
      nextPins.add(orderId);
      setPinned(nextPins);
      const before = new Map(draftDates);
      const overrides = new Map<string, string | null>();
      overrides.set(orderId, toDate);
      rerun(nextPins, overrides);
      // Toast count = how many *non-pinned* stops landed on a different date.
      requestAnimationFrame(() => {
        let moved = 0;
        setDraftDates((curr) => {
          for (const [id, d] of curr.entries()) {
            if (id === orderId) continue;
            if (nextPins.has(id)) continue;
            if (before.get(id) !== d) moved++;
          }
          if (moved > 0) showRescheduleToast(moved);
          return curr;
        });
      });
    },
    [captureUndoSnapshot, pinned, draftDates, rerun, showRescheduleToast]
  );

  const handleAdd = useCallback(
    (orderId: string, toDate: string) => {
      handleMoveTo(orderId, toDate);
    },
    [handleMoveTo]
  );

  const handleRemove = useCallback(
    (orderId: string) => {
      captureUndoSnapshot();
      const nextPins = new Set(pinned);
      nextPins.delete(orderId);
      setPinned(nextPins);
      setDraftDates((prev) => {
        const next = new Map(prev);
        next.set(orderId, null);
        return next;
      });
    },
    [captureUndoSnapshot, pinned]
  );

  const handleTogglePin = useCallback(
    (orderId: string) => {
      setPinned((prev) => {
        const next = new Set(prev);
        if (next.has(orderId)) next.delete(orderId);
        else next.add(orderId);
        return next;
      });
    },
    []
  );

  const handlePushDay = useCallback(
    (date: string, days: number) => {
      const target = shiftDateByWorkdays(date, days);
      if (!horizonSet.has(target)) {
        toast({
          title: "That's outside the planning horizon",
          description: 'Extend the horizon or move jobs individually.',
          variant: 'destructive',
        });
        return;
      }
      captureUndoSnapshot();
      const movedIds: string[] = [];
      const overrides = new Map<string, string | null>();
      for (const [id, d] of draftDates.entries()) {
        if (d === date) {
          overrides.set(id, target);
          movedIds.push(id);
        }
      }
      // Pin everything we just shifted so re-run respects the move.
      const nextPins = new Set(pinned);
      for (const id of movedIds) nextPins.add(id);
      setPinned(nextPins);
      rerun(nextPins, overrides);
    },
    [horizonSet, captureUndoSnapshot, draftDates, pinned, rerun, toast]
  );

  const handlePushWeek = useCallback(
    (weekStart: string, days: number) => {
      captureUndoSnapshot();
      const movedIds: string[] = [];
      const overrides = new Map<string, string | null>();
      for (const [id, d] of draftDates.entries()) {
        if (!d) continue;
        const ws = format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (ws !== weekStart) continue;
        const target = shiftDateByWorkdays(d, days);
        if (!horizonSet.has(target)) {
          toast({
            title: 'Some jobs would fall outside the horizon',
            description: 'They will be left unscheduled.',
          });
          overrides.set(id, null);
        } else {
          overrides.set(id, target);
        }
        movedIds.push(id);
      }
      const nextPins = new Set(pinned);
      for (const id of movedIds) {
        const target = overrides.get(id);
        if (target) nextPins.add(id);
      }
      setPinned(nextPins);
      rerun(nextPins, overrides);
    },
    [captureUndoSnapshot, draftDates, pinned, rerun, horizonSet, toast]
  );

  const handleAutoSchedule = useCallback(() => {
    captureUndoSnapshot();
    rerun(pinned);
  }, [captureUndoSnapshot, rerun, pinned]);

  const handleDiscard = useCallback(() => {
    setDraftDates(new Map(savedBaseline));
    const initialPins = new Set<string>();
    for (const [id, date] of savedBaseline.entries()) {
      if (date) initialPins.add(id);
    }
    setPinned(initialPins);
  }, [savedBaseline]);

  const changeCount = useMemo(() => {
    let n = 0;
    for (const s of stops) {
      const draft = draftDates.get(s.orderId) ?? null;
      const baseline = savedBaseline.get(s.orderId) ?? null;
      if (draft !== baseline) n += 1;
    }
    return n;
  }, [stops, draftDates, savedBaseline]);
  const dirty = changeCount > 0;

  const handleSave = useCallback(async () => {
    const changes: { stop: ScheduleStop; date: string | null }[] = [];
    for (const s of stops) {
      const draft = draftDates.get(s.orderId) ?? null;
      const baseline = savedBaseline.get(s.orderId) ?? null;
      if (draft !== baseline) changes.push({ stop: s, date: draft });
    }
    if (changes.length === 0) {
      toast({ title: 'Nothing to save' });
      return;
    }
    try {
      await saveMutation.mutateAsync({ changes });
      // Refresh baseline from current draft and lock everything saved.
      const nextBaseline = new Map(savedBaseline);
      const nextPins = new Set(pinned);
      for (const { stop, date } of changes) {
        nextBaseline.set(stop.orderId, date);
        if (date) nextPins.add(stop.orderId);
        else nextPins.delete(stop.orderId);
      }
      setSavedBaseline(nextBaseline);
      setPinned(nextPins);
      toast({ title: 'Schedule saved', description: `${changes.length} change${changes.length === 1 ? '' : 's'} committed.` });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      });
    }
  }, [stops, draftDates, savedBaseline, pinned, saveMutation, toast]);

  const handleMarkerClick = useCallback((orderId: string) => {
    setPinnedHighlightId((prev) => (prev === orderId ? null : orderId));
  }, []);

  const handleHover = useCallback((orderId: string | null) => {
    setHoveredOrderId(orderId);
  }, []);

  const handleFocusOrder = useCallback((orderId: string) => {
    setPinnedHighlightId((prev) => (prev === orderId ? null : orderId));
    setFocusNonce((n) => n + 1);
  }, []);

  const stopsByDate = useMemo(() => {
    const map = new Map<string, ScheduleStop[]>();
    const unscheduled: ScheduleStop[] = [];
    for (const s of stops) {
      const date = draftDates.get(s.orderId) ?? null;
      if (!date || !horizonSet.has(date)) {
        unscheduled.push(s);
        continue;
      }
      const list = map.get(date) ?? [];
      list.push(s);
      map.set(date, list);
    }
    return { map, unscheduled };
  }, [stops, draftDates, horizonSet]);

  const saveLabel = saveMutation.isPending
    ? 'Saving…'
    : changeCount === 0
      ? 'No changes'
      : `Save (${changeCount})`;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gardens-surf">
      <div className="flex shrink-0 flex-col gap-2 border-b border-gardens-bdr bg-gardens-surf px-3 py-2 md:flex-row md:items-center md:justify-between">
        <p className="text-xs leading-5 text-gardens-txs">
          {orderPins.length} confirmed · {stops.length} schedulable · {stopsByDate.unscheduled.length} unscheduled
          · 2-week horizon
          {dirty && (
            <span className="ml-2 inline-block rounded bg-gardens-na-amber-lt px-1.5 py-0.5 text-xs font-semibold uppercase text-gardens-na-amber">
              {changeCount} unsaved
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-11 md:h-9"
            onClick={handleAutoSchedule}
            disabled={isLoading || stops.length === 0}
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Auto-schedule
          </Button>
          {dirty && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-11 md:h-9">
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Discard
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard schedule changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Unsaved date assignments will revert to the last saved state.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDiscard}>Discard</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            size="sm"
            className="h-11 md:h-9"
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
            title={changeCount === 0 ? 'No changes to save' : `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}`}
            aria-label={changeCount === 0 ? 'No changes to save' : `Save ${changeCount} unsaved change${changeCount === 1 ? '' : 's'}`}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            {saveLabel}
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-gardens-bdr bg-gardens-surf p-2 md:hidden" role="tablist" aria-label="Map or list">
        {(['map', 'list'] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            role="tab"
            aria-selected={mobilePane === pane}
            onClick={() => setMobilePane(pane)}
            className={cn(
              'h-11 flex-1 rounded-md border text-sm font-semibold',
              mobilePane === pane
                ? 'border-gardens-tx bg-gardens-tx text-white'
                : 'border-gardens-bdr bg-gardens-page text-gardens-tx',
            )}
          >
            {pane === 'map' ? 'Map' : 'List'}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 md:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <div className={cn('min-h-0 flex-col bg-gardens-page', mobilePane === 'list' ? 'hidden md:flex' : 'flex')}>
          <PermitPinLegend
            pins={orderPins}
            hidden={hiddenStatuses}
            onToggle={toggleStatus}
            onShowAll={() => setHiddenStatuses(new Set())}
          />
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-gardens-txm-aa" />
                </div>
              ) : (
                <UkJobsMap
                  stops={mapStops}
                  draftDates={draftDates}
                  pinnedOrderIds={pinned}
                  highlightedOrderId={highlightedOrderId}
                  focusedOrderId={pinnedHighlightId}
                  focusNonce={focusNonce}
                  onMarkerClick={handleMarkerClick}
                  orderPins={visiblePins}
                  onOpenOrder={setPanelOrderId}
                  onReady={handleMapsReady}
                />
              )}
            </div>
          </div>
        </div>
        <div className={cn(
          'min-h-0 flex-col border-gardens-bdr md:border-l',
          mobilePane === 'map' ? 'hidden md:flex' : 'flex',
        )}>
          <div className="shrink-0 border-b border-gardens-bdr bg-gardens-surf px-3 pb-2 pt-3">
            <UnscheduledList
              stops={stopsByDate.unscheduled}
              highlightedOrderId={highlightedOrderId}
              onHover={handleHover}
              onFocus={handleFocusOrder}
            />
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gardens-page p-3 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:pb-3">
            {horizonWeeks.map(({ weekStart, dates }, idx) => {
              const summary = summariseWeek(dates, stopsByDate.map);
              const chips = [
                `${summary.jobs} job${summary.jobs === 1 ? '' : 's'}`,
                `${summary.kerb} kerb`,
                `${summary.other} other`,
                `${summary.empty} empty`,
              ];
              return (
                <div key={weekStart} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs">
                      {idx === 0 ? 'This week' : 'Next week'}
                      <span className="ml-2 font-normal normal-case text-gardens-txm-aa">
                        {format(parseISO(weekStart), 'd MMM')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1" aria-label="Week summary">
                      {chips.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-full border border-gardens-bdr bg-gardens-surf px-2 py-0.5 text-xs text-gardens-txs"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        title="Push this week +1 day"
                        onClick={() => handlePushWeek(weekStart, 1)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-gardens-bdr px-3 text-xs font-medium text-gardens-tx hover:bg-gardens-surf md:min-h-8 md:px-2"
                      >
                        <ArrowRight className="h-4 w-4" /> +1d
                      </button>
                      <button
                        type="button"
                        title="Push this week +1 week"
                        onClick={() => handlePushWeek(weekStart, 5)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-gardens-bdr px-3 text-xs font-medium text-gardens-tx hover:bg-gardens-surf md:min-h-8 md:px-2"
                      >
                        <ChevronsRight className="h-4 w-4" /> +1w
                      </button>
                    </div>
                  </div>
                  {dates.map((date) => (
                    <DayCard
                      key={date}
                      date={date}
                      stops={stopsByDate.map.get(date) ?? []}
                      unscheduled={stopsByDate.unscheduled}
                      pinnedOrderIds={pinned}
                      highlightedOrderId={highlightedOrderId}
                      horizonDates={horizonDates}
                      onAdd={(orderId) => handleAdd(orderId, date)}
                      onRemove={handleRemove}
                      onMove={handleMoveTo}
                      onTogglePin={handleTogglePin}
                      onPushDay={handlePushDay}
                      onHover={handleHover}
                      onFocus={handleFocusOrder}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {panelOrderId && (
        <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setPanelOrderId(null)} aria-hidden />
      )}
      <OrderDetailsSidebar
        order={panelOrderId ? panelOrder ?? null : null}
        onClose={() => setPanelOrderId(null)}
        onSelectOrder={setPanelOrderId}
      />
    </div>
  );
};
