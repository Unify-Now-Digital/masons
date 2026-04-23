import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Pill, Btn, Icon, AISuggestion } from '@/shared/components/gardens';
import { useLogistics } from '../hooks/useLogistics';
import type { LogisticsDayGroup, LogisticsStop, LogisticsWeek } from '../api/logistics.api';

type Tab = 'planner' | 'map';

export const LogisticsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('planner');
  const navigate = useNavigate();
  const logistics = useLogistics();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b border-gardens-bdr">
        <TabButton label="Planner" active={tab === 'planner'} onClick={() => setTab('planner')} />
        <TabButton label="Map" active={tab === 'map'} onClick={() => setTab('map')} />
      </div>

      {tab === 'planner' && (
        <PlannerTab
          loading={logistics.isLoading}
          data={logistics.data}
          onOpenMap={() => navigate('/dashboard/map')}
        />
      )}

      {tab === 'map' && (
        <Card padded>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span
              className="inline-flex items-center justify-center"
              style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--g-acc-lt)', color: 'var(--g-acc-dk)' }}
            >
              <Icon name="pin" size={20} stroke={1.8} />
            </span>
            <div>
              <h3 className="font-head text-[18px] font-semibold text-gardens-tx m-0">Map of Jobs</h3>
              <p className="text-[12.5px] text-gardens-txs mt-1 max-w-[520px]">
                The geographic view lives in the dedicated Map page. We'll fold it in here once the
                planner and map share their layer definitions.
              </p>
            </div>
            <Btn
              variant="primary"
              icon={<Icon name="arrowRight" size={12} />}
              onClick={() => navigate('/dashboard/map')}
            >
              Open Map of Jobs
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
};

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 16px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--g-ff-body)',
      fontSize: 13,
      fontWeight: 600,
      color: active ? 'var(--g-tx)' : 'var(--g-txs)',
      borderBottom: active ? '2px solid var(--g-acc)' : '2px solid transparent',
      marginBottom: -1,
    }}
  >
    {label}
  </button>
);

interface PlannerTabProps {
  loading: boolean;
  data?: {
    currentWeek: LogisticsWeek;
    nextWeek: LogisticsWeek;
    unscheduled: LogisticsStop[];
    totalActive: number;
  };
  onOpenMap: () => void;
}

const PlannerTab: React.FC<PlannerTabProps> = ({ loading, data, onOpenMap }) => {
  if (loading) {
    return (
      <Card padded>
        <div className="text-[12px] text-gardens-txs">Loading planner…</div>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      {data.unscheduled.length > 0 && (
        <AISuggestion
          title={`${data.unscheduled.length} job${data.unscheduled.length === 1 ? '' : 's'} awaiting a slot`}
          body="These are on the book but haven't been scheduled yet. Assign a day to keep the week flowing."
          actions={
            <>
              <Btn
                variant="ai"
                size="sm"
                icon={<Icon name="arrowRight" size={12} />}
                onClick={onOpenMap}
              >
                Plan on the map
              </Btn>
              <Btn variant="ghost" size="sm">
                Assign manually
              </Btn>
            </>
          }
        />
      )}

      <WeekBlock week={data.currentWeek} tone="current" />
      <WeekBlock week={data.nextWeek} tone="next" />

      <UnscheduledCard stops={data.unscheduled} />
    </div>
  );
};

interface WeekBlockProps {
  week: LogisticsWeek;
  tone: 'current' | 'next';
}

const WeekBlock: React.FC<WeekBlockProps> = ({ week, tone }) => (
  <div>
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">
          {tone === 'current' ? 'This week' : 'Next week'}
        </h3>
        <div className="text-[11.5px] text-gardens-txs">{week.label}</div>
      </div>
      <Pill tone={week.totalStops === 0 ? 'neutral' : tone === 'current' ? 'amber' : 'blue'}>
        {week.totalStops} stop{week.totalStops === 1 ? '' : 's'}
      </Pill>
    </div>
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
    >
      {week.days.map((day) => (
        <DayCard key={day.date} day={day} />
      ))}
    </div>
  </div>
);

const DayCard: React.FC<{ day: LogisticsDayGroup }> = ({ day }) => {
  const empty = day.stops.length === 0;
  return (
    <Card padded={false} style={{ padding: 12, minHeight: 140, opacity: empty ? 0.72 : 1 }}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gardens-txm">
          {day.label}
        </div>
        <Pill tone={empty ? 'neutral' : 'accent'}>{day.stopCount}</Pill>
      </div>
      {empty ? (
        <div className="text-[11px] text-gardens-txm italic">—</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {day.stops.slice(0, 4).map((stop) => (
            <StopRow key={stop.jobId} stop={stop} />
          ))}
          {day.stops.length > 4 && (
            <div className="text-[10.5px] text-gardens-txm italic">
              +{day.stops.length - 4} more
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const StopRow: React.FC<{ stop: LogisticsStop }> = ({ stop }) => (
  <div className="flex flex-col gap-0.5">
    <div className="text-[12.5px] font-semibold text-gardens-tx truncate">{stop.customerName}</div>
    <div className="text-[10.5px] text-gardens-txs truncate">
      {stop.locationName || stop.address || '—'}
    </div>
    {stop.crew.length > 0 && (
      <div className="text-[10px] text-gardens-txm italic truncate">{stop.crew.join(', ')}</div>
    )}
  </div>
);

const UnscheduledCard: React.FC<{ stops: LogisticsStop[] }> = ({ stops }) => (
  <Card padded>
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <h3 className="font-head text-[15px] font-semibold text-gardens-tx m-0">Unscheduled</h3>
        <div className="text-[11.5px] text-gardens-txs">Open jobs without a booked date</div>
      </div>
      <Pill tone={stops.length > 0 ? 'amber' : 'green'} dot>
        {stops.length} waiting
      </Pill>
    </div>
    {stops.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">Everything in the window is scheduled.</div>
    ) : (
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        {stops.map((stop) => (
          <div
            key={stop.jobId}
            className="p-3 flex flex-col gap-1"
            style={{
              background: 'var(--g-surf2)',
              border: '1px solid var(--g-bdr)',
              borderRadius: 8,
            }}
          >
            <div className="text-[13px] font-semibold text-gardens-tx truncate">{stop.customerName}</div>
            <div className="text-[11px] text-gardens-txs truncate">
              {stop.locationName || stop.address || 'No location'}
            </div>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Pill
                tone={
                  stop.priority === 'high' ? 'red' : stop.priority === 'medium' ? 'amber' : 'neutral'
                }
              >
                {stop.priority}
              </Pill>
              <Pill tone="blue">{stop.status.replace(/_/g, ' ')}</Pill>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);
