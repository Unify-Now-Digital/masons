import { ChevronDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import type { InquiryChannel } from '../types/inquiries';

const OPTIONS: { value: InquiryChannel; label: string }[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'quote', label: 'Quote' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'call', label: 'Call' },
  { value: 'shortlist', label: 'Shortlist' },
];

interface ChannelFilterProps {
  value: InquiryChannel[];
  onChange: (next: InquiryChannel[]) => void;
}

export function ChannelFilter({ value, onChange }: ChannelFilterProps) {
  const set = new Set(value);

  const toggle = (ch: InquiryChannel, checked: boolean) => {
    const next = new Set(set);
    if (checked) next.add(ch);
    else next.delete(ch);
    onChange(OPTIONS.map((o) => o.value).filter((v) => next.has(v)));
  };

  const summary =
    value.length === OPTIONS.length ? 'All channels' : `${value.length} channel${value.length === 1 ? '' : 's'}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('justify-between min-w-[160px] font-normal')}>
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-4 w-4 opacity-60 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-2">
          {OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={`ch-${opt.value}`}
                checked={set.has(opt.value)}
                onCheckedChange={(c) => toggle(opt.value, c === true)}
              />
              <Label htmlFor={`ch-${opt.value}`} className="text-sm font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
