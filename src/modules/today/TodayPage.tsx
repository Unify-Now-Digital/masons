import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOpenOrder } from '@/shared/context/orderPanel';
import { useOpenPerson } from '@/shared/context/personPanel';
import { useSharedPriority } from '@/shared/priority';
import { useNow } from '@/modules/sections/useSectionsData';
import { useBrandData } from './useBrandData';
import { allTodayInputs } from './todayRules';
import { buildToday, LANES, updateSeen, type Lane, type TodayItem } from './todayModel';
import { hubLaneItems } from './sharedLanes';
import { ErrorNote } from './ui';
import { readGroup, readView, writeGroup, writeView, type TodayGroupBy, type TodayView } from './queueView';
import { useTodayDone } from './sessionDone';
import { TodayQueue } from './TodayQueue';

const seenKey = (org: string) => `mason-today-seen:${org}`;
const readSeen = (org: string | null): Record<string, string> => {
  if (!org) return {};
  try { return JSON.parse(localStorage.getItem(seenKey(org)) ?? '{}'); } catch { return {}; }
};

/** Today: one ranked queue for the active brand. Lane chips filter it; All is the default. */
export const TodayPage: React.FC = () => {
  const navigate = useNavigate();
  const openOrder = useOpenOrder();
  const openPerson = useOpenPerson();
  const go = (i: { to: string }) => {
    const m = /\/dashboard\/orders\?order=([^&]+)/.exec(i.to);
    if (m) openOrder(decodeURIComponent(m[1]));
    else navigate(i.to);
  };
  const open = (i: TodayItem) => {
    if (i.orderId) openOrder(i.orderId);
    else if (i.personId || i.conversationId) openPerson({ personId: i.personId ?? null, conversationId: i.conversationId, name: i.name });
    else go(i);
  };
  const nowDate = useNow();
  const now = nowDate.getTime();
  const canSeeMoney = useCanSeeMoney();
  const { organizationId } = useOrganization();
  const q = useBrandData(canSeeMoney);
  const [view, setView] = useState<TodayView>(() => readView(organizationId));
  const [groupBy, setGroupBy] = useState<TodayGroupBy>(() => readGroup(organizationId));
  const [showLater, setShowLater] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen(organizationId));
  const { done } = useTodayDone(organizationId, nowDate);
  useEffect(() => setSeen(readSeen(organizationId)), [organizationId]);
  useEffect(() => {
    setView(readView(organizationId));
    setGroupBy(readGroup(organizationId));
    setShowLater(false);
  }, [organizationId]);

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

  const rowsFor = (l: Lane): TodayItem[] => (l === 'Sales' || l === 'CS' ? sharedItems[l] : plan?.today[l] ?? []);
  const allRows = useMemo(
    () => lanes.flatMap((l) => (l === 'Sales' || l === 'CS' ? sharedItems[l] : plan?.today[l] ?? [])),
    [lanes, sharedItems, plan],
  );
  const rows = view === 'All' ? allRows : rowsFor(view);
  const later = view === 'All' || view === 'Sales' || view === 'CS' ? [] : plan?.later[view] ?? [];
  const sharedLoading = (view === 'Sales' && shared.enquiriesLoading) || (view === 'CS' && shared.customersLoading);

  const onSelect = (item: TodayItem) => {
    setSelectedKey(item.key);
    // Pane 2 is 11c. Until it is mounted, a row opens the side panel at every width.
    open(item);
  };

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[400px_minmax(0,1fr)]" data-testid="today">
      <TodayQueue
        allRows={allRows}
        rows={rows}
        later={later}
        showLater={showLater}
        onToggleLater={() => setShowLater((v) => !v)}
        lanes={lanes}
        view={view}
        onView={selectView}
        rowsFor={rowsFor}
        groupBy={groupBy}
        onGroupBy={selectGroup}
        now={nowDate}
        nowMs={now}
        done={done}
        selectedKey={selectedKey}
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
    </div>
  );
};
