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
import { DayCard, EmptyDayRun } from './DayCard';
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
import { countDraftChanges, shownPlacement, suggestionMap } from '../../utils/scheduleDraft';
import { compose } from '../../utils/capacityRules';
import { OrderDetailsSidebar } from '@/modules/orders/components/OrderDetailsSidebar';
import { SidePanel } from '@/shared/components/panel/SidePanel';
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

type ScheduleDayGroup =
  | { kind: 'day'; date: string }
  | { kind: 'empty'; dates: string[] };

function groupScheduleDays(dates: string[], byDate: Map<string, ScheduleStop[]>): ScheduleDayGroup[] {
  const groups: ScheduleDayGroup[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length === 0) return;
    if (run.length >= 3) groups.push({ kind: 'empty', dates: run });
    else for (const date of run) groups.push({ kind: 'day', date });
    run = [];
  };
  for (const date of dates) {
    if ((byDate.get(date) ?? []).length === 0) run.push(date);
    else {
      flush();
      groups.push({ kind: 'day', date });
    }
  }
  flush();
  return groups;
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
  const { data: stops = [], isLoading, isError, refetch } = useScheduleData();
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
  const [pinDock, setPinDock] = useState<React.ReactNode>(null);
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [savedBaseline, setSavedBaseline] = useState<Map<string, string | null>>(new Map());
  const [suggestions, setSuggestions] = useState<Map<string, string | null>>(new Map());
  const [hasAutoProposed, setHasAutoProposed] = useState(false);

  const horizonDates = useMemo(() => buildHorizonDates(new Date(), HORIZON_WORKDAYS), []);
  const horizonWeeks = useMemo(() => groupByWeek(horizonDates), [horizonDates]);
  const horizonSet = useMemo(() => new Set(horizonDates), [horizonDates]);

  // Initial sync: saved dates are the draft. Anything autoSchedule would add
  // on top is a suggestion, not an unsaved edit. Saved dates outside the
  // horizon stay pinned so they are not moved onto a nearer day.
  useEffect(() => {
    if (stops.length === 0 || hasAutoProposed) return;
    const baseline = new Map<string, string | null>();
    const initialPins = new Set<string>();
    const pinMap = new Map<string, string>();
    for (const s of stops) {
      baseline.set(s.orderId, s.scheduledDate);
      if (s.scheduledDate) {
        initialPins.add(s.orderId);
        pinMap.set(s.orderId, s.scheduledDate);
      }
    }
    const proposed = autoSchedule(stops, {
      pins: pinMap,
      horizonWorkdays: HORIZON_WORKDAYS,
    });
    setSavedBaseline(baseline);
    setDraftDates(new Map(baseline));
    setSuggestions(suggestionMap(stops.map((s) => s.orderId), proposed, baseline, baseline));
    setPinned(initialPins);
    setHasAutoProposed(true);
  }, [stops, hasAutoProposed]);

  // Re-run autoSchedule. `apply` writes the whole proposal into the draft
  // (the Auto-schedule button — a user edit). Otherwise only overrides and
  // dates the user already changed stay in the draft; the rest refresh as
  // suggestions.
  const rerun = useCallback(
    (pins: Set<string>, overrides: Map<string, string | null> = new Map(), apply = false) => {
      const pinMap = new Map<string, string>();
      for (const s of stops) {
        const saved = savedBaseline.get(s.orderId) ?? null;
        const current = overrides.has(s.orderId)
          ? overrides.get(s.orderId)
          : (draftDates.get(s.orderId) ?? saved);
        if (pins.has(s.orderId) && current) pinMap.set(s.orderId, current);
        else if (saved && (draftDates.get(s.orderId) ?? saved) === saved && !overrides.has(s.orderId)) {
          pinMap.set(s.orderId, saved);
        }
      }
      const proposed = autoSchedule(stops, {
        pins: pinMap,
        horizonWorkdays: HORIZON_WORKDAYS,
      });
      const ids = stops.map((s) => s.orderId);
      if (apply) {
        const next = new Map<string, string | null>();
        for (const id of ids) next.set(id, proposed.get(id) ?? null);
        setDraftDates(next);
        setSuggestions(new Map());
        return;
      }
      const nextDraft = new Map(savedBaseline);
      for (const s of stops) {
        const current = draftDates.get(s.orderId) ?? null;
        const saved = savedBaseline.get(s.orderId) ?? null;
        if (current !== saved) nextDraft.set(s.orderId, current);
      }
      for (const [id, date] of overrides) nextDraft.set(id, date ?? null);
      setDraftDates(nextDraft);
      setSuggestions(suggestionMap(ids, proposed, savedBaseline, nextDraft));
    },
    [stops, draftDates, savedBaseline]
  );

  const undoSnapshotRef = useRef<{
    draftDates: Map<string, string | null>;
    suggestions: Map<string, string | null>;
    pinned: Set<string>;
  } | null>(null);

  const captureUndoSnapshot = useCallback(() => {
    undoSnapshotRef.current = {
      draftDates: new Map(draftDates),
      suggestions: new Map(suggestions),
      pinned: new Set(pinned),
    };
  }, [draftDates, suggestions, pinned]);

  const applyUndo = useCallback(() => {
    const snap = undoSnapshotRef.current;
    if (!snap) return;
    setDraftDates(snap.draftDates);
    setSuggestions(snap.suggestions);
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
      setSuggestions((prev) => {
        if (!prev.has(orderId)) return prev;
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
    },
    [captureUndoSnapshot, pinned]
  );

  const handleTogglePin = useCallback(
    (orderId: string) => {
      const wasPinned = pinned.has(orderId);
      setPinned((prev) => {
        const next = new Set(prev);
        if (wasPinned) next.delete(orderId);
        else next.add(orderId);
        return next;
      });
      if (wasPinned) return;
      const placement = shownPlacement(orderId, draftDates, savedBaseline, suggestions);
      if (!placement.suggested || !placement.date) return;
      setDraftDates((prev) => {
        const next = new Map(prev);
        next.set(orderId, placement.date);
        return next;
      });
      setSuggestions((prev) => {
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
    },
    [pinned, draftDates, savedBaseline, suggestions]
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
      for (const s of stops) {
        const placement = shownPlacement(s.orderId, draftDates, savedBaseline, suggestions);
        if (placement.date === date) {
          overrides.set(s.orderId, target);
          movedIds.push(s.orderId);
        }
      }
      // Pin everything we just shifted so re-run respects the move.
      const nextPins = new Set(pinned);
      for (const id of movedIds) nextPins.add(id);
      setPinned(nextPins);
      rerun(nextPins, overrides);
    },
    [horizonSet, captureUndoSnapshot, draftDates, savedBaseline, suggestions, stops, pinned, rerun, toast]
  );

  const handlePushWeek = useCallback(
    (weekStart: string, days: number) => {
      captureUndoSnapshot();
      const movedIds: string[] = [];
      const overrides = new Map<string, string | null>();
      for (const s of stops) {
        const placement = shownPlacement(s.orderId, draftDates, savedBaseline, suggestions);
        const d = placement.date;
        if (!d) continue;
        const ws = format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (ws !== weekStart) continue;
        const target = shiftDateByWorkdays(d, days);
        if (!horizonSet.has(target)) {
          toast({
            title: 'Some jobs would fall outside the horizon',
            description: 'They will be left unscheduled.',
          });
          overrides.set(s.orderId, null);
        } else {
          overrides.set(s.orderId, target);
        }
        movedIds.push(s.orderId);
      }
      const nextPins = new Set(pinned);
      for (const id of movedIds) {
        const target = overrides.get(id);
        if (target) nextPins.add(id);
      }
      setPinned(nextPins);
      rerun(nextPins, overrides);
    },
    [captureUndoSnapshot, draftDates, savedBaseline, suggestions, stops, pinned, rerun, horizonSet, toast]
  );

  const handleAutoSchedule = useCallback(() => {
    captureUndoSnapshot();
    rerun(pinned, new Map(), true);
  }, [captureUndoSnapshot, rerun, pinned]);

  const handleDiscard = useCallback(() => {
    const nextDraft = new Map(savedBaseline);
    setDraftDates(nextDraft);
    const initialPins = new Set<string>();
    const pinMap = new Map<string, string>();
    for (const [id, date] of savedBaseline.entries()) {
      if (date) {
        initialPins.add(id);
        pinMap.set(id, date);
      }
    }
    setPinned(initialPins);
    const proposed = autoSchedule(stops, { pins: pinMap, horizonWorkdays: HORIZON_WORKDAYS });
    setSuggestions(suggestionMap(stops.map((s) => s.orderId), proposed, savedBaseline, nextDraft));
  }, [savedBaseline, stops]);

  const changeCount = useMemo(
    () => countDraftChanges(stops.map((s) => s.orderId), draftDates, savedBaseline),
    [stops, draftDates, savedBaseline],
  );
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
    const suggestedOrderIds = new Set<string>();
    for (const s of stops) {
      const placement = shownPlacement(s.orderId, draftDates, savedBaseline, suggestions);
      if (placement.suggested) suggestedOrderIds.add(s.orderId);
      if (!placement.date || !horizonSet.has(placement.date)) {
        unscheduled.push(s);
        continue;
      }
      const list = map.get(placement.date) ?? [];
      list.push(s);
      map.set(placement.date, list);
    }
    return { map, unscheduled, suggestedOrderIds };
  }, [stops, draftDates, savedBaseline, suggestions, horizonSet]);

  const displayDates = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const s of stops) {
      map.set(s.orderId, shownPlacement(s.orderId, draftDates, savedBaseline, suggestions).date);
    }
    return map;
  }, [stops, draftDates, savedBaseline, suggestions]);

  const saveLabel = saveMutation.isPending
    ? 'Saving…'
    : changeCount === 0
      ? 'No changes'
      : `Save (${changeCount})`;

  return (
    <>
    <div className={cn('flex min-h-full flex-col bg-gardens-surf lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden', panelOrderId && 'lg:mr-[420px]')}>
      <div className={cn(
        'shrink-0 flex-col gap-2 border-b border-gardens-bdr bg-gardens-surf px-3 py-2 lg:flex lg:flex-row lg:items-center lg:justify-between',
        toolsOpen ? 'flex' : 'hidden lg:flex',
      )}>
        <p className="text-xs leading-5 text-gardens-txs">
          {stopsByDate.unscheduled.length} to schedule · {stops.filter((s) => !s.scheduledDate).length} without a date · next 2 weeks
          {stopsByDate.suggestedOrderIds.size > 0 && (
            <span className="ml-2 inline-block rounded bg-gardens-page px-1.5 py-0.5 text-xs font-medium text-gardens-txs">
              {stopsByDate.suggestedOrderIds.size} suggested
            </span>
          )}
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
            className="h-11 lg:h-9"
            onClick={handleAutoSchedule}
            disabled={isLoading || stops.length === 0}
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Auto-schedule
          </Button>
          {dirty && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-11 lg:h-9">
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
            className="h-11 lg:h-9"
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

      <div className="flex shrink-0 items-center gap-2 border-b border-gardens-bdr bg-gardens-surf px-2 lg:hidden">
        <button
          type="button"
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((open) => !open)}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-xs font-semibold text-gardens-tx"
        >
          {toolsOpen ? 'Hide tools' : 'Tools'}
        </button>
        <p className="min-w-0 flex-1 truncate text-xs text-gardens-txs">
          {stopsByDate.unscheduled.length} to schedule · {stops.filter((s) => !s.scheduledDate).length} without a date · next 2 weeks
        </p>
        {!toolsOpen && (
          <PermitPinLegend
            variant="unplaced"
            pins={orderPins}
            hidden={hiddenStatuses}
            onToggle={toggleStatus}
            onShowAll={() => setHiddenStatuses(new Set())}
          />
        )}
      </div>

      {isError && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gardens-bdr bg-gardens-surf px-3 py-2" role="alert">
          <p className="m-0 text-[13px] text-gardens-tx">Couldn't load the schedule.</p>
          <button type="button" onClick={() => refetch()} className="inline-flex min-h-11 items-center rounded-md border border-gardens-bdr bg-white px-3 text-[13px] font-semibold text-gardens-tx">
            Try again
          </button>
        </div>
      )}

      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
      <div className={cn('flex min-h-full flex-col lg:grid lg:h-full lg:min-h-0 lg:grid-rows-1', pinDock ? 'lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)_420px]' : 'lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]')}>
        <div className="flex h-[50vh] min-h-[16rem] shrink-0 flex-col bg-gardens-page lg:h-auto lg:min-h-0">
          <div className="hidden lg:block">
            <PermitPinLegend
              pins={orderPins}
              hidden={hiddenStatuses}
              onToggle={toggleStatus}
              onShowAll={() => setHiddenStatuses(new Set())}
            />
          </div>
          {toolsOpen && (
            <div className="max-h-40 overflow-y-auto lg:hidden">
              <PermitPinLegend
                pins={orderPins}
                hidden={hiddenStatuses}
                onToggle={toggleStatus}
                onShowAll={() => setHiddenStatuses(new Set())}
              />
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0">
              <UkJobsMap
                stops={mapStops}
                draftDates={displayDates}
                suggestedOrderIds={stopsByDate.suggestedOrderIds}
                pinnedOrderIds={pinned}
                highlightedOrderId={highlightedOrderId}
                focusedOrderId={pinnedHighlightId}
                focusNonce={focusNonce}
                onMarkerClick={handleMarkerClick}
                orderPins={visiblePins}
                onOpenOrder={setPanelOrderId}
                onPinDock={setPinDock}
                onReady={handleMapsReady}
              />
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-gardens-page" role="status" aria-label="Loading schedule">
                  <div className="absolute inset-6 animate-pulse rounded-md bg-gardens-bdr/50" />
                  <Loader2 className="relative h-6 w-6 animate-spin text-gardens-txm-aa" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col border-t border-gardens-bdr lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-gardens-bdr bg-gardens-surf px-3 pb-2 pt-3">
            <UnscheduledList
              stops={stopsByDate.unscheduled}
              highlightedOrderId={highlightedOrderId}
              onHover={handleHover}
              onFocus={handleFocusOrder}
            />
          </div>
          <div className="flex flex-col gap-3 bg-gardens-page p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-3">
            {horizonWeeks.map(({ weekStart, dates }, idx) => {
              const summary = summariseWeek(dates, stopsByDate.map);
              const chips = [
                `${summary.jobs} job${summary.jobs === 1 ? '' : 's'}`,
                `${summary.kerb} kerb`,
                `${summary.other} other`,
                `${summary.empty} empty`,
              ];
              return (
                <div key={weekStart} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs">
                      {idx === 0 ? 'This week' : 'Next week'}
                      <span className="font-normal normal-case tracking-normal text-gardens-txm-aa">{` · ${format(parseISO(weekStart), 'd MMM')}`}</span>
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
                        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-gardens-bdr px-3 text-xs font-medium text-gardens-tx hover:bg-gardens-surf lg:h-7 lg:min-h-7 lg:px-2 lg:text-[11px]"
                      >
                        <ArrowRight className="h-4 w-4" /> +1d
                      </button>
                      <button
                        type="button"
                        title="Push this week +1 week"
                        onClick={() => handlePushWeek(weekStart, 5)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-gardens-bdr px-3 text-xs font-medium text-gardens-tx hover:bg-gardens-surf lg:h-7 lg:min-h-7 lg:px-2 lg:text-[11px]"
                      >
                        <ChevronsRight className="h-4 w-4" /> +1w
                      </button>
                    </div>
                  </div>
                  {groupScheduleDays(dates, stopsByDate.map).map((group) =>
                    group.kind === 'empty' ? (
                      <EmptyDayRun
                        key={`${group.dates[0]}-${group.dates[group.dates.length - 1]}`}
                        dates={group.dates}
                        unscheduled={stopsByDate.unscheduled}
                        pinnedOrderIds={pinned}
                        highlightedOrderId={highlightedOrderId}
                        suggestedOrderIds={stopsByDate.suggestedOrderIds}
                        horizonDates={horizonDates}
                        onAdd={(orderId, date) => handleAdd(orderId, date)}
                        onRemove={handleRemove}
                        onMove={handleMoveTo}
                        onTogglePin={handleTogglePin}
                        onPushDay={handlePushDay}
                        onHover={handleHover}
                        onFocus={handleFocusOrder}
                      />
                    ) : (
                      <DayCard
                        key={group.date}
                        date={group.date}
                        stops={stopsByDate.map.get(group.date) ?? []}
                        unscheduled={stopsByDate.unscheduled}
                        pinnedOrderIds={pinned}
                        highlightedOrderId={highlightedOrderId}
                        suggestedOrderIds={stopsByDate.suggestedOrderIds}
                        horizonDates={horizonDates}
                        onAdd={(orderId) => handleAdd(orderId, group.date)}
                        onRemove={handleRemove}
                        onMove={handleMoveTo}
                        onTogglePin={handleTogglePin}
                        onPushDay={handlePushDay}
                        onHover={handleHover}
                        onFocus={handleFocusOrder}
                      />
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {pinDock ? (
          <div className="hidden h-full min-h-0 lg:flex lg:flex-col" data-testid="map-pin-column">
            {pinDock}
          </div>
        ) : null}
      </div>
      </div>
    </div>
    {panelOrderId && !panelOrder ? (
      <SidePanel mode="overlay" label="Order" kicker="Order" name="Loading…" onClose={() => setPanelOrderId(null)}>
        <p className="m-0 px-6 py-4 text-[13px] text-gardens-txs">Loading order…</p>
      </SidePanel>
    ) : (
    <OrderDetailsSidebar
        order={panelOrder ?? null}
        onClose={() => setPanelOrderId(null)}
        onSelectOrder={setPanelOrderId}
      />
    )}
    </>
  );
};
