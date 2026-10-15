import React, { useMemo } from 'react';
import { PERMIT_PIN_STYLES, type OrderPin, type PermitPinStatus } from '../../utils/permitPins';

interface Props {
  pins: OrderPin[];
  hidden: Set<PermitPinStatus>;
  onToggle: (status: PermitPinStatus) => void;
  onShowAll: () => void;
}

/** Legend + filter chips for the permit-coloured order pins (colours follow the CM ClickUp Orders list). */
export const PermitPinLegend: React.FC<Props> = ({ pins, hidden, onToggle, onShowAll }) => {
  const counts = useMemo(() => {
    const m = new Map<PermitPinStatus, { total: number; unplaced: number }>();
    for (const p of pins) {
      const c = m.get(p.permitStatus) ?? { total: 0, unplaced: 0 };
      c.total += 1;
      if (p.lat == null || p.lng == null) c.unplaced += 1;
      m.set(p.permitStatus, c);
    }
    return m;
  }, [pins]);
  const unplaced = pins.filter((p) => p.lat == null || p.lng == null);
  const styles = PERMIT_PIN_STYLES.filter((s) => s.status !== 'unknown' || counts.has('unknown'));

  return (
    <div className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-md border border-zinc-200 bg-white/95 px-2 py-1.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter pins by permit status">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mr-0.5">Permit</span>
        {styles.map((s) => {
          const c = counts.get(s.status)?.total ?? 0;
          const off = hidden.has(s.status);
          return (
            <button
              key={s.status}
              type="button"
              aria-pressed={!off}
              onClick={() => onToggle(s.status)}
              title={`ClickUp: ${s.clickupStatus} (${s.colour})`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                off ? 'border-zinc-200 bg-zinc-50 text-zinc-400 line-through' : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: s.hollow ? '#fff' : s.colour,
                  border: `2.5px solid ${s.colour}`,
                  opacity: off ? 0.4 : 1,
                }}
              />
              {s.label}
              <span className="text-zinc-500 tabular-nums">{c}</span>
            </button>
          );
        })}
        {hidden.size > 0 && (
          <button type="button" onClick={onShowAll} className="text-[11px] text-zinc-600 underline px-1">
            Show all
          </button>
        )}
      </div>
      {unplaced.length > 0 && (
        <div className="mt-1 text-[11px] text-zinc-500" title={unplaced.map((p) => `${p.ref} ${p.customerName}`).join('\n')}>
          {unplaced.length} confirmed order{unplaced.length === 1 ? '' : 's'} not on the map (no cemetery address)
        </div>
      )}
    </div>
  );
};
