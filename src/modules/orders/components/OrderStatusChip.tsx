import React from 'react';
import { ACTION_COLOUR_CLASS, type ActionColour } from '@/shared/nextAction';

export const OrderStatusChip: React.FC<{ k: string; v: string; colour: ActionColour | 'grey' }> = ({ k, v, colour }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold leading-4 ${colour === 'grey' ? 'bg-gardens-page text-gardens-txs' : ACTION_COLOUR_CLASS[colour].tint}`}>
    <span className="font-medium opacity-70">{k}</span>{v}
  </span>
);
