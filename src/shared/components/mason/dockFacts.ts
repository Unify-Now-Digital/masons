import { formatPhoneDisplay } from '@/modules/inbox/utils/contactTitle';

export const DOCK_TONE = {
  red: 'text-gardens-na-red',
  amber: 'text-gardens-na-amber',
  green: 'text-gardens-na-green',
  muted: 'text-gardens-tx',
} as const;

export type DockFactTone = keyof typeof DOCK_TONE;

export interface DockFact {
  label: string;
  value: string;
  tone?: DockFactTone;
}

/** Email and phone, or a WhatsApp number when that is the only contact. */
export function dockContactLine(email?: string | null, phone?: string | null, channel?: string | null): string {
  const mail = email?.trim() || '';
  const tel = phone?.trim() || '';
  const whatsapp = (channel ?? '').toLowerCase() === 'whatsapp' && tel;
  if (mail && whatsapp) return `${mail} · WhatsApp ${formatPhoneDisplay(tel)}`;
  if (whatsapp) return `WhatsApp ${formatPhoneDisplay(tel)}`;
  if (mail && tel) return `${mail} · ${formatPhoneDisplay(tel)}`;
  return mail || (tel ? formatPhoneDisplay(tel) : '');
}
