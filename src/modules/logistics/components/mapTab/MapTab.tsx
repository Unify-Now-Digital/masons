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

  // Draft scheduling state. Always present for every stop currently in view
  // so the map and side panel agree on what's where. Initialised from DB
  // values, then overwritten by auto-schedule and user actions.
  const [draftDates, setDraftDates] = useState<Map<string, string | null>>(new Map());
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
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
            className="text-xs font-medium px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50"
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

  const dirty = useMemo(() => {
    for (const s of stops) {
      const draft = draftDates.get(s.orderId) ?? null;
      const baseline = savedBaseline.get(s.orderId) ?? null;
      if (draft !== baseline) return true;
    }
    return false;
  }, [stops, draftDates, savedBaseline]);

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
    setHighlightedOrderId((prev) => (prev === orderId ? null : orderId));
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

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[640px] rounded-md border border-zinc-200 overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 bg-white">
        <div className="text-xs text-zinc-600">
          {stops.length} schedulable · {stopsByDate.unscheduled.length} unscheduled
          · 2-week horizon
          {dirty && (
            <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase">
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoSchedule}
            disabled={isLoading || stops.length === 0}
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
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
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
              stops={stops}
              draftDates={draftDates}
              pinnedOrderIds={pinned}
              highlightedOrderId={highlightedOrderId}
              onMarkerClick={handleMarkerClick}
            />
          )}
        </div>
        <div className="border-l border-zinc-200 min-h-0 flex flex-col">
          <div className="px-3 pt-3 pb-2 border-b border-zinc-200 bg-white">
            <UnscheduledList
              stops={stopsByDate.unscheduled}
              highlightedOrderId={highlightedOrderId}
              onHover={setHighlightedOrderId}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50">
            {horizonWeeks.map(({ weekStart, dates }, idx) => (
              <div key={weekStart} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    {idx === 0 ? 'This week' : 'Next week'}
                    <span className="ml-2 font-normal text-zinc-400">
                      {format(parseISO(weekStart), 'd MMM')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Push this week +1 day"
                      onClick={() => handlePushWeek(weekStart, 1)}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-zinc-300 hover:bg-white text-zinc-700 flex items-center gap-0.5"
                    >
                      <ArrowRight className="w-3 h-3" /> +1d
                    </button>
                    <button
                      type="button"
                      title="Push this week +1 week"
                      onClick={() => handlePushWeek(weekStart, 5)}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-zinc-300 hover:bg-white text-zinc-700 flex items-center gap-0.5"
                    >
                      <ChevronsRight className="w-3 h-3" /> +1w
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
                    onHover={setHighlightedOrderId}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
