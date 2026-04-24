import React from 'react';
import { ReplyChannelPills, type ReplyChannel } from './ReplyChannelPills';

interface ChannelSelectorProps {
  value: ReplyChannel;
  onChange: (value: ReplyChannel) => void;
  disabledChannels?: ReplyChannel[];
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  value,
  onChange,
  disabledChannels = [],
}) => {
  const channels: ReplyChannel[] = ['email', 'sms', 'whatsapp'];
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-xs text-gardens-txs">Reply via</span>
      <ReplyChannelPills
        channels={channels}
        value={value}
        onChange={onChange}
        disabledChannels={disabledChannels}
      />
    </div>
  );
};

