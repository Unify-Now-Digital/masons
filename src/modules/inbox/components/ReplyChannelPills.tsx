import React from 'react';
import { cn } from '@/shared/lib/utils';

const CHANNEL_LABELS: Record<'email' | 'sms' | 'whatsapp', string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

export type ReplyChannel = 'email' | 'sms' | 'whatsapp';

export interface ReplyChannelPillsProps {
  channels: readonly ReplyChannel[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledChannels?: ReplyChannel[];
  className?: string;
}

/** Segmented pill control for reply channel. Selected = dark green; unselected = light grey. */
export const ReplyChannelPills: React.FC<ReplyChannelPillsProps> = ({
  channels,
  value,
  onChange,
  disabled = false,
  disabledChannels = [],
  className,
}) => (
  <div className={cn('flex items-center gap-1 flex-wrap', className)}>
    {channels.map((ch) => {
      const isSelected = value === ch;
      const isDisabled = disabled || disabledChannels.includes(ch);
      return (
        <button
          key={ch}
          type="button"
          disabled={isDisabled}
          onClick={() => onChange(ch)}
          title={isDisabled ? 'No valid destination for this channel' : undefined}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
            isSelected
              ? 'bg-emerald-700 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            isDisabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          {CHANNEL_LABELS[ch]}
        </button>
      );
    })}
  </div>
);
