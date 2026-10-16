import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { cn } from '@/shared/lib/utils';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOpenOrder } from '@/shared/context/orderPanel';
import { useOpenPerson } from '@/shared/context/personPanel';
import { primeDraft } from '@/modules/inbox/utils/primedDraft';
import { useSharedPriority } from '@/shared/priority';
import { useNow } from '@/modules/sections/useSectionsData';
import { useBrandData } from './useBrandData';
import { allTodayInputs } from './todayRules';
import { buildToday, LANES, updateSeen, type Lane, type TodayItem } from './todayModel';
import { mergeLater, toPersonRows, type PersonRow } from './personRows';
import { hubLaneItems, withoutMoney } from './sharedLanes';
import { ErrorNote } from './ui';
import { readGroup, readView, todayColumns, viewFromSearch, writeGroup, writeView, type TodayColumns, type TodayGroupBy, type TodayView } from './queueView';
import { useTodayDone } from './sessionDone';
import { useTodayHidden } from './sessionSnooze';
import { prepare, type Prepared } from './prepare';
import { isTextField } from './detailText';
import { sendPreparedMessage } from './todaySend';
import { TodayQueue } from './TodayQueue';
import { TodayDetail } from './TodayDetail';
import { TodayDock } from './TodayDock';
import type { BrandData } from './brandData.types';

function hasPrepared(task: TodayItem): boolean {
  return (task as TodayItem & { prepared?: Prepared | null }).prepared != null;
}

const seenKey = (org: string) => `mason-today-seen:${org}`;
const readSeen = (org: string | null): Record<string, string> => {
  if (!org) return {};
  try { return JSON.parse(localStorage.getItem(seenKey(org)) ?? '{}'); } catch { return {}; }
};

function useTodayColumns(): TodayColumns {
  const [cols, setCols] = useState(todayColumns);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia('(min-width: 1280px)');
    const mid = window.matchMedia('(min-width: 1024px)');
    const apply = () => setCols(wide.matches ? 'three' : mid.matches ? 'split' : 'queue');
    apply();
    wide.addEventListener?.('change', apply);
    mid.addEventListener?.('change', apply);
    return () => {
      wide.removeEventListener?.('change', apply);
      mid.removeEventListener?.('change', apply);
    };
  }, []);
  return cols;
}

/** Today: queue, action, and from 1280px a docked context panel. */
export const TodayPage: React.FC = () => {
  const navigate = useNavigate();
  const openOrder = useOpenOrder();
  const openPerson = useOpenPerson();
  const open = useCallback((i: TodayItem) => {
    if (i.orderId) openOrder(i.orderId);
    else if (i.personId || i.conversationId) openPerson({ personId: i.personId ?? null, conversationId: i.conversationId, name: i.name });
    else {
      const m = /\/dashboard\/orders\?order=([^&]+)/.exec(i.to);
      if (m) openOrder(decodeURIComponent(m[1]));
      else navigate(i.to);
    }
  }, [openOrder, openPerson, navigate]);
  const nowDate = useNow();
  const now = nowDate.getTime();
  const canSeeMoney = useCanSeeMoney();
  const { organizationId } = useOrganization();
  const q = useBrandData(canSeeMoney);
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const laneFromUrl = viewFromSearch(search);
  const [view, setView] = useState<TodayView>(() => laneFromUrl ?? readView(organizationId));
  const [dockOpen, setDockOpen] = useState(true);
  const [groupBy, setGroupBy] = useState<TodayGroupBy>(() => readGroup(organizationId));
  const [showLater, setShowLater] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [taskKey, setTaskKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paneOpen, setPaneOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const [callKey, setCallKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen(organizationId));
  const { done, complete } = useTodayDone(organizationId, nowDate);
  const { hidden, snooze, dismiss } = useTodayHidden(organizationId, nowDate);
  const cols = useTodayColumns();
  const actionDocked = cols !== 'queue';
  useEffect(() => setSeen(readSeen(organizationId)), [organizationId]);
  useEffect(() => {
    const fromUrl = viewFromSearch(search);
    setView(fromUrl ?? readView(organizationId));
    if (fromUrl && organizationId) writeView(organizationId, fromUrl);
    setGroupBy(readGroup(organizationId));
    setShowLater(false);
    setSelectedKey(null);
    setSheetOpen(false);
    setPaneOpen(true);
  }, [organizationId, search]);
  useEffect(() => { if (actionDocked) setSheetOpen(false); }, [actionDocked]);
  useEffect(() => {
    if (actionDocked || !sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionDocked, sheetOpen]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const selectView = (v: TodayView) => {
    setView(v);
    setShowLater(false);
    if (organizationId) writeView(organizationId, v);
  };
  const selectGroup = (g: TodayGroupBy) => {
    setGroupBy(g);
    if (organizationId) writeGroup(organizationId, g);
  };

  const plan = useMemo(
    () => (q.data ? buildToday(allTodayInputs(q.data.data, now, canSeeMoney), now, seen) : null),
    [q.data, now, canSeeMoney, seen],
  );
  useEffect(() => {
    if (!plan || !organizationId) return;
    const next = updateSeen(seen, plan, now);
    if (JSON.stringify(next) === JSON.stringify(seen)) return;
    localStorage.setItem(seenKey(organizationId), JSON.stringify(next));
    setSeen(next);
  }, [plan, organizationId, seen, now]);

  const lanes = LANES;
  const shared = useSharedPriority();
  const sharedItems = useMemo(() => {
    const sales = canSeeMoney ? shared.enquiries : withoutMoney(shared.enquiries);
    const customers = canSeeMoney ? shared.customers : withoutMoney(shared.customers);
    return {
      Sales: hubLaneItems(sales, 'Sales', now),
      CS: hubLaneItems(customers, 'CS', now),
    };
  }, [shared.enquiries, shared.customers, now, canSeeMoney]);

  const rowsFor = useCallback(
    (l: Lane): TodayItem[] => (l === 'Sales' || l === 'CS' ? sharedItems[l] : plan?.today[l] ?? []),
    [sharedItems, plan],
  );
  const allRows = useMemo(
    () => lanes.flatMap((l) => (l === 'Sales' || l === 'CS' ? sharedItems[l] : plan?.today[l] ?? [])),
    [lanes, sharedItems, plan],
  );
  const rawRows = view === 'All' ? allRows : rowsFor(view);
  const later = useMemo(
    () => (view === 'All' || view === 'Sales' || view === 'CS' ? [] : plan?.later[view] ?? []),
    [view, plan],
  );
  const sharedLoading = (view === 'Sales' && shared.enquiriesLoading) || (view === 'CS' && shared.customersLoading);
  const brand = (q.data?.data ?? null) as BrandData | null;
  const visible = useCallback((list: TodayItem[]) => list.filter((item) => !hidden(item.key)), [hidden]);
  const withPrep = useCallback((list: TodayItem[]) => visible(list).map((item) => ({ ...item, prepared: prepare(item, brand) })), [visible, brand]);
  const listed = useMemo(
    () => mergeLater(toPersonRows(withPrep(rawRows), now, done), toPersonRows(withPrep(later), now, done), now, done),
    [withPrep, rawRows, later, now, done],
  );
  const people = listed.rows;
  const laterPeople = listed.laterOnly;
  const allPeople = useMemo(() => toPersonRows(withPrep(allRows), now, done), [withPrep, allRows, now, done]);
  const peopleFor = useCallback((lane: Lane) => toPersonRows(withPrep(rowsFor(lane)), now, done), [withPrep, rowsFor, now, done]);
  const peopleLaterFor = useCallback((lane: Lane) => {
    if (lane === 'Sales' || lane === 'CS') return [];
    return toPersonRows(withPrep(plan?.later[lane] ?? []), now, done);
  }, [withPrep, plan, now, done]);
  const preparedKey = people.find((row) => !row.done && row.tasks.some((task) => !done[task.key] && hasPrepared(task)))?.key ?? null;
  const resolvedKey = selectedKey && people.some((row) => row.key === selectedKey)
    ? selectedKey
    : preparedKey ?? people.find((row) => !row.done)?.key ?? null;
  const person = people.find((row) => row.key === resolvedKey) ?? null;
  const explicit = person?.tasks.find((task) => task.key === taskKey && !done[task.key]) ?? null;
  const selected = explicit ?? person?.tasks.find((task) => !done[task.key] && hasPrepared(task)) ?? person?.lead ?? null;
  const rank = person ? people.findIndex((row) => row.key === person.key) + 1 : 0;
  const prepared: Prepared | null = selected
    ? prepare(callKey === selected.key ? { ...selected, kind: 'call', verb: 'CALL' } : selected, brand)
    : null;
  const showCallInstead = !!selected && selected.kind === 'reply' && (selected.lateBy ?? 0) > 72 && callKey !== selected.key && prepared?.type === 'message';
  const messageBody = prepared?.type === 'message' ? prepared.body.join('\n\n') : null;
  useEffect(() => {
    setDraft(messageBody ?? '');
  }, [selected?.key, callKey, messageBody]);

  const finish = useCallback((verb: string, item: TodayItem) => {
    const owner = people.find((row) => row.tasks.some((task) => task.key === item.key));
    const stillOpen = (task: TodayItem) => task.key !== item.key && !done[task.key];
    const nextTask = owner?.tasks.find((task) => stillOpen(task) && hasPrepared(task)) ?? null;
    const idx = people.findIndex((row) => row.key === owner?.key);
    const rest = [...people.slice(idx + 1), ...people.slice(0, Math.max(idx, 0))];
    const nextPrepared = rest.find((row) => row.key !== owner?.key && row.tasks.some((task) => stillOpen(task) && hasPrepared(task)));
    const nextOpen = rest.find((row) => row.key !== owner?.key && row.tasks.some(stillOpen));
    complete(item.key, verb);
    setTaskKey(null);
    if (nextTask && owner) setSelectedKey(owner.key);
    else setSelectedKey(nextPrepared?.key ?? nextOpen?.key ?? owner?.key ?? null);
    const nextName = nextTask?.name ?? nextPrepared?.name ?? nextOpen?.name ?? null;
    setToast(nextName ? `${verb}: ${item.name} · next: ${nextName}` : `${verb}: ${item.name}`);
    setSendError(null);
  }, [people, done, complete]);

  const runPrimary = useCallback(async () => {
    if (!selected || busy) return;
    const prep = prepare(callKey === selected.key ? { ...selected, kind: 'call', verb: 'CALL' } : selected, brand);
    if (!prep) {
      open(selected);
      if (!actionDocked) setSheetOpen(true);
      return;
    }
    if (prep.type === 'call') {
      finish('Called', selected);
      return;
    }
    if (prep.type === 'message') {
      const body = (draft || prep.body.join('\n\n')).trim();
      if (!selected.conversationId) {
        primeDraft(selected.conversationId ?? null, body, null, { basis: 'edited' });
        open(selected);
        return;
      }
      setBusy(true);
      setSendError(null);
      try {
        await sendPreparedMessage(prep.channel, selected.conversationId, body, selected.subject ?? undefined);
        finish('Sent', selected);
      } catch (err) {
        setSendError((err as Error).message || 'Could not send');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (prep.target !== 'open' && selected.orderId) {
      const section = prep.target === 'stone' ? 'stone' : prep.target === 'permit' ? 'permit' : 'payments';
      openOrder(selected.orderId, { section });
    } else open(selected);
  }, [selected, busy, callKey, brand, open, actionDocked, finish, openOrder, draft]);

  const onEdit = useCallback(() => {
    if (!selected) return;
    if (prepared?.type === 'message') primeDraft(selected.conversationId ?? null, prepared.body.join('\n\n'), null, { basis: 'edited' });
    open(selected);
  }, [selected, prepared, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTextField(e.target)) return;
      const key = e.key.toLowerCase();
      if (key !== 'j' && key !== 'k' && key !== 'e' && key !== 't') return;
      if (!people.length) return;
      e.preventDefault();
      if (key === 'j' || key === 'k') {
        const idx = Math.max(0, people.findIndex((row) => row.key === resolvedKey));
        const step = key === 'j' ? 1 : -1;
        const next = people[(idx + step + people.length) % people.length];
        setSelectedKey(next.key);
        setTaskKey(null);
        setPaneOpen(true);
        return;
      }
      if (key === 't') {
        if (selected) snooze(selected.key);
        return;
      }
      void runPrimary();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [people, resolvedKey, selected, snooze, runPrimary]);

  const onSelect = (row: PersonRow) => {
    setSelectedKey(row.key);
    setTaskKey(null);
    setSendError(null);
    setPaneOpen(true);
    setDockOpen(true);
    if (!actionDocked) setSheetOpen(true);
  };

  const openFull = () => { if (selected) open(selected); };

  const detail = selected && person ? (
    <TodayDetail
      item={selected}
      rank={rank}
      total={people.length}
      now={nowDate}
      doneVerb={done[selected.key]}
      customer={person.customer}
      system={person.system}
      also={person.tasks.filter((task) => task.key !== selected.key)}
      onOpenAlso={(task) => { setTaskKey(task.key); setSendError(null); }}
      prepared={prepared}
      busy={busy}
      error={sendError}
      showCallInstead={showCallInstead}
      onPrimary={() => { void runPrimary(); }}
      onEdit={onEdit}
      onTomorrow={() => snooze(selected.key)}
      onDismiss={() => dismiss(selected.key)}
      onCallOutcome={(outcome) => {
        const verb = outcome.startsWith('Spoke') ? 'Called' : outcome.startsWith('No answer') ? 'No answer' : 'Voicemail';
        finish(verb, selected);
      }}
      onCallInstead={() => setCallKey(selected.key)}
      onClose={actionDocked ? undefined : () => setSheetOpen(false)}
      showOpenFull={cols !== 'three'}
      onOpenFull={openFull}
      draft={draft}
      onDraft={setDraft}
    />
  ) : (
    <div className="hidden h-full min-h-0 flex-col justify-center border-l border-gardens-bdr bg-gardens-surf2 px-6 lg:flex" data-testid="today-detail">
      <p className="m-0 text-[13px] text-gardens-txs">Nothing to do in this list.</p>
    </div>
  );

  const grid = cols === 'three' && dockOpen
    ? 'min-[1280px]:grid min-[1280px]:h-full min-[1280px]:grid-cols-[372px_minmax(0,1fr)_420px]'
    : cols === 'three' || cols === 'split'
      ? 'lg:grid lg:h-full lg:grid-cols-[372px_minmax(0,1fr)]'
      : '';

  return (
    <div className={cn(
      'flex min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden lg:min-h-0 lg:flex-1 lg:overflow-hidden',
      grid,
    )} data-testid="today" data-columns={cols}>
      <TodayQueue
        allRows={allPeople}
        rows={people}
        later={laterPeople}
        showLater={showLater}
        onToggleLater={() => setShowLater((v) => !v)}
        lanes={lanes}
        view={view}
        onView={selectView}
        rowsFor={peopleFor}
        laterFor={peopleLaterFor}
        groupBy={groupBy}
        onGroupBy={selectGroup}
        now={nowDate}
        selectedKey={resolvedKey}
        onSelect={onSelect}
        loading={q.isLoading && !plan}
        emptyText={sharedLoading ? 'Ranking…' : view === 'All' ? 'Nothing to do today.' : `Nothing to do in ${view} today.`}
        notice={(
          <>
            {q.isError && <div className="px-3 pt-2"><ErrorNote title="Couldn't load Today." message={(q.error as Error).message} /></div>}
            {q.data?.moneyError && <div className="px-3 pt-2"><ErrorNote title="Money data didn't load, so Finance rows are missing:" message={q.data.moneyError} /></div>}
          </>
        )}
      />
      {actionDocked && paneOpen && detail}
      {cols === 'three' && dockOpen && person && selected && (
        <TodayDock
          item={selected}
          customer={person.customer}
          onOpenFull={openFull}
          onClose={() => setDockOpen(false)}
        />
      )}
      {!actionDocked && sheetOpen && selected && (
        <div className="fixed inset-0 z-50 flex min-h-0 flex-col bg-gardens-surf2" role="dialog" aria-label="Today" data-testid="today-sheet">
          {detail}
        </div>
      )}
      {toast && (
        <div role="status" data-testid="today-toast" className="fixed right-4 top-4 z-[60] flex h-9 items-center rounded-lg bg-gardens-tx px-3 text-[13px] font-semibold text-white">
          {toast}
        </div>
      )}
    </div>
  );
};
