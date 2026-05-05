import type { DateRangePreset, InquiriesFilterState, InquiryChannel } from '../types/inquiries';
import { ChannelFilter } from './ChannelFilter';
import { DateRangeFilter } from './DateRangeFilter';

interface InquiriesFiltersProps {
  filters: InquiriesFilterState;
  onChange: (next: InquiriesFilterState) => void;
}

export function InquiriesFilters({ filters, onChange }: InquiriesFiltersProps) {
  const setChannels = (channels: InquiryChannel[]) => {
    if (channels.length === 0) return;
    onChange({ ...filters, channels });
  };

  const setPreset = (preset: DateRangePreset) => {
    onChange({ ...filters, preset });
  };

  const setCustom = (customFrom: Date | null, customTo: Date | null) => {
    onChange({ ...filters, customFrom, customTo });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gardens-bdr bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gardens-txs">Channels</span>
        <ChannelFilter value={filters.channels} onChange={setChannels} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gardens-txs">Date range</span>
        <DateRangeFilter
          preset={filters.preset}
          customFrom={filters.customFrom}
          customTo={filters.customTo}
          onPresetChange={setPreset}
          onCustomChange={setCustom}
        />
      </div>
    </div>
  );
}
