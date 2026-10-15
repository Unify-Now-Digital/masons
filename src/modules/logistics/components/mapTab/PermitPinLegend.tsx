import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PERMIT_PIN_STYLES, permitPinStyle, type OrderPin, type PermitPinStatus } from '../../utils/permitPins';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { PermitStatusMark } from './PermitStatusMark';

interface Props {
  pins: OrderPin[];
  hidden: Set<PermitPinStatus>;
  onToggle: (status: PermitPinStatus) => void;
  onShowAll: () => void;
}

/** Toolbar filter chips for permit-coloured pins. Colours stay the status tokens. */
export const PermitPinLegend: React.FC<Props> = ({ pins, hidden, onToggle, onShowAll }) => {
  const [listOpen, setListOpen] = useState(false);
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
  const unplaced = useMemo(
    () =>
      pins
        .filter((p) => p.lat == null || p.lng == null)
        .slice()
        .sort((a, b) => a.ref.localeCompare(b.ref)),
    [pins],
  );
  const styles = PERMIT_PIN_STYLES.filter((s) => s.status !== 'unknown' || counts.has('unknown'));

  return (
    <div className="shrink-0 border-b border-gardens-bdr bg-gardens-surf">
      <div
        className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-2 py-1.5 md:flex-wrap md:overflow-visible"
        role="group"
        aria-label="Filter pins by permit status"
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gardens-txs">Permit</span>
        {styles.map((s) => {
          const c = counts.get(s.status)?.total ?? 0;
          const off = hidden.has(s.status);
          return (
            <button
              key={s.status}
              type="button"
              aria-pressed={!off}
              aria-label={`${off ? 'Show' : 'Hide'} ${s.label}, ${c}`}
              onClick={() => onToggle(s.status)}
              title={off ? `Show ${s.label}` : `Hide ${s.label}`}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition md:min-h-8 md:px-2.5 ${
                off
                  ? 'border-gardens-bdr bg-gardens-page text-gardens-txs line-through'
                  : 'border-gardens-bdr bg-gardens-surf text-gardens-tx hover:bg-gardens-page'
              }`}
            >
              <PermitStatusMark status={s.status} off={off} />
              {s.label}
              <span className="tabular-nums text-gardens-txs">{c}</span>
            </button>
          );
        })}
        {hidden.size > 0 && (
          <button
            type="button"
            onClick={onShowAll}
            className="inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-medium text-gardens-tx underline underline-offset-2 md:min-h-8"
          >
            Show all
          </button>
        )}
        {unplaced.length > 0 && (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-medium text-gardens-tx underline underline-offset-2 md:min-h-8"
          >
            {unplaced.length} not on map
          </button>
        )}
      </div>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100%-1.5rem)] flex-col gap-3 overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Not on the map</DialogTitle>
            <DialogDescription className="text-sm text-gardens-txs">
              {unplaced.length} confirmed order{unplaced.length === 1 ? '' : 's'} with no cemetery location, so there is no pin.
            </DialogDescription>
          </DialogHeader>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {unplaced.map((p) => {
              const label = permitPinStyle(p.permitStatus).label;
              return (
                <li key={p.orderId}>
                  <Link
                    to={`/dashboard/orders?order=${encodeURIComponent(p.orderId)}`}
                    className="flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-gardens-page"
                  >
                    <PermitStatusMark status={p.permitStatus} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gardens-tx">{p.ref}</span>
                      <span className="text-gardens-txs"> · {p.customerName}</span>
                      <span className="block truncate text-gardens-txs">
                        {p.cemeteryName} · {label}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-gardens-tx">Open</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
};
