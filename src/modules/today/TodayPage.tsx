import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
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
import { hubLaneItems } from './sharedLanes';
import { ErrorNote } from './ui';
import { isTodayDocked, readGroup, readView, writeGroup, writeView, type TodayGroupBy, type TodayView } from './queueView';
import { useTodayDone } from './sessionDone';
import { useTodayHidden } from './sessionSnooze';
import { prepare, type Prepared } from './prepare';
import { isTextField } from './detailText';
import { sendPreparedMessage } from './todaySend';
import { TodayQueue } from './TodayQueue';
import { TodayDetail } from './TodayDetail';
import type { BrandData } from './brandData.types';

const seenKey = (org: string) => `mason-today-seen:${org}`;
const readSeen = (org: string | null): Record<string, string> => {
  if (!org) return {};
  try { return JSON.parse(localStorage.getItem(seenKey(org)) ?? '{}'); } catch { return {}; }
};

function useDockedPane(): boolean {
  const [docked, setDocked] = useState(isTodayDocked);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setDocked(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return docked;
}

/** Today: one ranked queue. From 1024px the detail pane is docked and shows the first unfinished row. */
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
  const [view, setView] = useState<TodayView>(() => readView(organizationId));
  const [groupBy, setGroupBy] = useState<TodayGroupBy>(() => readGroup(organizationId));
  const [showLater, setShowLater] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [taskKey, setTaskKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [callKey, setCallKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen(organizationId));
  const { done, complete } = useTodayDone(organizationId, nowDate);
  const { hidden, snooze, dismiss } = useTodayHidden(organizationId, nowDate);
  const docked = useDockedPane();
  useEffect(() => setSeen(readSeen(organizationId)), [organizationId]);
  useEffect(() => {
    setView(readView(organizationId));
    setGroupBy(readGroup(organizationId));
    setShowLater(false);
    setSelectedKey(null);
    setSheetOpen(false);
  }, [organizationId]);
  useEffect(() => { if (docked) setSheetOpen(false); }, [docked]);
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
    if (JSON.stringify(next) !== JSON.stringify(seen)) localStorage.setItem(seenKey(organizationId), JSON.stringify(next));
  }, [plan, organizationId, seen, now]);

  const lanes = useMemo(() => LANES.filter((l) => l !== 'Finance' || canSeeMoney), [canSeeMoney]);
  const shared = useSharedPriority();
  const sharedItems = useMemo(() => ({
    Sales: hubLaneItems(shared.enquiries, 'Sales', now),
    CS: hubLaneItems(shared.customers, 'CS', now),
  }), [shared.enquiries, shared.customers, now]);

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
  const resolvedKey = people.some((row) => row.key === selectedKey)
    ? selectedKey
    : people.find((row) => !row.done)?.key ?? null;
  const person = people.find((row) => row.key === resolvedKey) ?? null;
  const selected = person?.tasks.find((task) => task.key === taskKey && !done[task.key]) ?? person?.lead ?? null;
  const rank = person ? people.findIndex((row) => row.key === person.key) + 1 : 0;
  const prepared: Prepared | null = selected
    ? prepare(callKey === selected.key ? { ...selected, kind: 'call', verb: 'CALL' } : selected, brand)
    : null;
  const showCallInstead = !!selected && selected.kind === 'reply' && (selected.lateBy ?? 0) > 72 && callKey !== selected.key && prepared?.type === 'message';

  const finish = useCallback((verb: string, item: TodayItem) => {
    const owner = people.find((row) => row.tasks.some((task) => task.key === item.key));
    const nextTask = owner?.tasks.find((task) => task.key !== item.key && !done[task.key]) ?? null;
    const idx = people.findIndex((row) => row.key === owner?.key);
    const nextPerson = [...people.slice(idx + 1), ...people.slice(0, Math.max(idx, 0))]
      .find((row) => row.key !== owner?.key && row.tasks.some((task) => task.key !== item.key && !done[task.key]));
    complete(item.key, verb);
    setTaskKey(null);
    if (nextTask && owner) setSelectedKey(owner.key);
    else setSelectedKey(nextPerson?.key ?? owner?.key ?? null);
    const nextName = nextTask?.name ?? nextPerson?.name ?? null;
    setToast(nextName ? `${verb}: ${item.name} · next: ${nextName}` : `${verb}: ${item.name}`);
    setSendError(null);
  }, [people, done, complete]);

  const runPrimary = useCallback(async () => {
    if (!selected || busy) return;
    const prep = prepare(callKey === selected.key ? { ...selected, kind: 'call', verb: 'CALL' } : selected, brand);
    if (!prep) {
      open(selected);
      if (!docked) setSheetOpen(true);
      return;
    }
    if (prep.type === 'call') {
      finish('Called', selected);
      return;
    }
    if (prep.type === 'message') {
      const body = prep.body.join('\n\n');
      if (!selected.conversationId) {
        primeDraft(selected.conversationId ?? null, body);
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
    if (selected.orderId) {
      const section = prep.target === 'stone' ? 'stone' : prep.target === 'permit' ? 'permit' : 'payments';
      openOrder(selected.orderId, { section });
    } else open(selected);
  }, [selected, busy, callKey, brand, open, docked, finish, openOrder]);

  const onEdit = useCallback(() => {
    if (!selected) return;
    if (prepared?.type === 'message') primeDraft(selected.conversationId ?? null, prepared.body.join('\n\n'));
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
    if (!docked) setSheetOpen(true);
  };

  const detail = selected && person ? (
    <TodayDetail
      item={selected}
      rank={rank}
      total={people.length}
      now={nowDate}
      doneVerb={done[selected.key]}
      customer={person.customer}
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
      onClose={docked ? undefined : () => setSheetOpen(false)}
    />
  ) : (
    <div className="hidden min-h-0 flex-col justify-center border-l border-gardens-bdr bg-gardens-surf2 px-6 lg:flex" data-testid="today-detail">
      <p className="m-0 text-[13px] text-gardens-txs">Nothing to do in this list.</p>
    </div>
  );

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[400px_minmax(0,1fr)]" data-testid="today">
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
      {docked && detail}
      {!docked && sheetOpen && selected && (
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
