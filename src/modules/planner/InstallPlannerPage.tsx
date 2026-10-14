import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleSlash, MapPin, Truck, Map as MapIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { StatusSymbol, NextActionPill } from '@/shared/components/mason';
import { useNow, useSectionOrders } from '@/modules/sections/useSectionsData';
import { installTray, weekBoard, weekStart, type SectionOrder } from '@/modules/sections/sectionsView';

const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** mapping-v1 install planner: a "Ready to book" tray beside the week board. Read-only. */
export const InstallPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { orders, isLoading } = useSectionOrders();
  const [weekOffset, setWeekOffset] = useState(0);
  const now = useNow();
  const thisMonday = weekStart(now).getTime();
  const monday = useMemo(() => {
    const m = new Date(thisMonday);
    m.setDate(m.getDate() + 7 * weekOffset);
    return m;
  }, [weekOffset, thisMonday]);
  const tray = useMemo(() => installTray(orders), [orders]);
  const board = useMemo(() => weekBoard(orders, monday), [orders, monday]);
  const open = (o: SectionOrder) => navigate(`/dashboard/orders?order=${encodeURIComponent(o.id)}`);
  const total = tray.ready.length + tray.blocked.length;
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="m-0 font-head text-xl sm:text-2xl font-semibold text-gardens-tx">Install planner</h1>
          {(['This week', 'Next week', 'Week after'] as const).map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setWeekOffset(i)}
              aria-pressed={weekOffset === i}
              className={cn(
                'h-7 rounded-full px-3 text-xs font-semibold border',
                weekOffset === i ? 'bg-gardens-tx text-white border-gardens-tx' : 'bg-white text-gardens-tx border-gardens-bdr',
              )}
            >
              {label}
            </button>
          ))}
          <span className="text-[12px] text-gardens-txs">
            {monday.toLocaleDateString('en-GB', { day: 'numeric' })}–{friday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/logistics?tab=map')}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gardens-bdr bg-white text-[13px] text-gardens-tx hover:bg-gardens-page"
        >
          <MapIcon className="h-3.5 w-3.5" /> Open map
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)] flex-1 min-h-0">
        <aside className="rounded-[10px] border border-gardens-bdr bg-gardens-surf overflow-auto" aria-label="Ready to book">
          <div className="px-3 py-2.5 border-b border-gardens-bdr" data-testid="planner-cue">
            <div className="font-head text-[18px] font-semibold text-gardens-tx">{total} ready to book</div>
            <div className="text-[12px] text-gardens-txs">
              {tray.blocked.length} blocked · stone, permit and proof done, no install date
            </div>
          </div>
          {isLoading ? (
            <p className="p-3 text-[12px] text-gardens-txs">Loading…</p>
          ) : total === 0 ? (
            <p className="p-3 text-[13px] text-gardens-txs">Nothing ready to book.</p>
          ) : (
            <>
              <TrayGroup title="Ready: stone, permit, proof done" icon={<CheckCircle2 className="h-3 w-3" />} rows={tray.ready} onOpen={open} />
              <TrayGroup title="Ready but blocked" icon={<CircleSlash className="h-3 w-3" />} rows={tray.blocked} onOpen={open} blocked />
            </>
          )}
        </aside>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 min-h-0" data-testid="planner-week">
          {board.map(({ day, bookings }) => (
            <div key={day.toISOString()} className="rounded-[10px] border border-gardens-bdr bg-gardens-surf p-2 flex flex-col gap-2 min-h-[160px]">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-gardens-tx">{dayLabel(day)}</span>
                <span className="text-[11px] text-gardens-txm-aa">{bookings.length} booked</span>
              </div>
              {bookings.length === 0 ? (
                <p className="m-auto text-[12px] text-gardens-txm-aa text-center">Free</p>
              ) : (
                bookings.map((o) => (
                  <button key={o.id} type="button" onClick={() => open(o)} className="text-left rounded-lg border border-gardens-bdr bg-white p-2 hover:bg-gardens-page">
                    <span className="block font-head text-[13px] font-semibold text-gardens-tx truncate">{o.customer}</span>
                    <span className="block text-[11px] text-gardens-txs truncate">{o.location || 'Cemetery not set'}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-gardens-txm-aa">
                      <StatusSymbol state="unknown" stage="Family confirmation" size="sm" /> Family confirmation not recorded
                    </span>
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TrayGroup: React.FC<{ title: string; icon: React.ReactNode; rows: SectionOrder[]; onOpen: (o: SectionOrder) => void; blocked?: boolean }> = ({ title, icon, rows, onOpen, blocked }) =>
  rows.length === 0 ? null : (
    <section>
      <h3 className="m-0 px-3 py-1.5 bg-gardens-page text-[11px] font-extrabold uppercase tracking-[0.08em] text-gardens-txs flex items-center gap-1.5">
        {icon} {title} <span className="font-semibold">{rows.length}</span>
      </h3>
      {rows.map((o) => (
        <button key={o.id} type="button" onClick={() => onOpen(o)} className="w-full text-left px-3 py-2 border-b border-gardens-bdr hover:bg-gardens-page flex flex-col gap-1">
          <span className="flex items-center justify-between gap-2">
            <span className="font-head text-[14px] font-semibold text-gardens-tx truncate">{o.customer}</span>
            <span className="font-mono text-[11px] text-gardens-txm-aa">{o.ref}</span>
          </span>
          <span className="flex items-center gap-1 text-[12px] text-gardens-txs">
            <MapPin className="h-3 w-3" /> {o.location || 'Cemetery not set'}
          </span>
          <span className="flex items-center justify-between gap-2">
            {blocked ? (
              <span className="text-[12px] text-gardens-sem-red font-semibold">No deposit yet</span>
            ) : (
              <span className="text-[12px] text-gardens-sem-green inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Deposit in</span>
            )}
            {blocked ? (
              <NextActionPill action={{ kind: 'deposit', label: 'Request deposit', reason: '', tone: 'neutral' }} />
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gardens-tx"><Truck className="h-3.5 w-3.5" /> Book install</span>
            )}
          </span>
        </button>
      ))}
    </section>
  );
