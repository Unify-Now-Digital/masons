import { ACTION_COLOUR_CLASS } from '@/shared/nextAction';
import type { Colour } from './todayModel';

export const COLOUR_CLASS: Record<Colour, string> = {
  red: `${ACTION_COLOUR_CLASS.red.tint} border-transparent`,
  amber: `${ACTION_COLOUR_CLASS.amber.tint} border-transparent`,
  green: `${ACTION_COLOUR_CLASS.green.tint} border-transparent`,
  blue: `${ACTION_COLOUR_CLASS.blue.tint} border-transparent`,
};

export const gbp0 = (n: number | null | undefined) => (n == null ? '—' : `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`);
export const gbp2 = (n: number | null | undefined) => (n == null ? '—' : `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
