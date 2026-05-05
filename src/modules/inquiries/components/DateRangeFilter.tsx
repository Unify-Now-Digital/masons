import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import type { DateRangePreset } from '../types/inquiries';

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'all_time', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

interface DateRangeFilterProps {
  preset: DateRangePreset;
  customFrom: Date | null;
  customTo: Date | null;
  onPresetChange: (p: DateRangePreset) => void;
  onCustomChange: (from: Date | null, to: Date | null) => void;
}

export function DateRangeFilter({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomChange,
}: DateRangeFilterProps) {
  const fromStr = customFrom ? customFrom.toISOString().slice(0, 10) : '';
  const toStr = customTo ? customTo.toISOString().slice(0, 10) : '';

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant={preset === p.id ? 'default' : 'outline'}
            size="sm"
            className={preset === p.id ? 'bg-gardens-acc hover:bg-gardens-acc-dk text-white' : ''}
            onClick={() => onPresetChange(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="inq-from" className="text-xs text-gardens-txs">
              From
            </Label>
            <Input
              id="inq-from"
              type="date"
              className="h-9 w-[150px]"
              value={fromStr}
              onChange={(e) => {
                const v = e.target.value;
                onCustomChange(v ? new Date(`${v}T12:00:00`) : null, customTo);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inq-to" className="text-xs text-gardens-txs">
              To
            </Label>
            <Input
              id="inq-to"
              type="date"
              className="h-9 w-[150px]"
              value={toStr}
              onChange={(e) => {
                const v = e.target.value;
                onCustomChange(customFrom, v ? new Date(`${v}T12:00:00`) : null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
