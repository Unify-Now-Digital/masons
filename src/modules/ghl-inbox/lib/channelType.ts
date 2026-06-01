import type { GhlMessageItem } from '../api/ghlInbox.api';

/** GHL send-message API channel types (derived from thread, not user-picked). */
export type GhlSendChannelType = 'SMS' | 'Email' | 'WhatsApp' | 'IG' | 'FB' | 'Live_Chat';

const MESSAGE_TYPE_TO_SEND: Record<string, GhlSendChannelType> = {
  sms: 'SMS',
  type_sms: 'SMS',
  email: 'Email',
  type_email: 'Email',
  whatsapp: 'WhatsApp',
  type_whatsapp: 'WhatsApp',
  ig: 'IG',
  type_ig: 'IG',
  instagram: 'IG',
  fb: 'FB',
  type_fb: 'FB',
  facebook: 'FB',
  live_chat: 'Live_Chat',
  livechat: 'Live_Chat',
  type_live_chat: 'Live_Chat',
};

function normalizeMessageType(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Derive GHL send `type` from the conversation thread's message types.
 * Uses the most recent message with a mappable messageType.
 */
export function deriveConversationChannelType(
  messages: GhlMessageItem[],
): GhlSendChannelType | null {
  const sorted = [...messages].sort((a, b) => {
    const ta = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
    const tb = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
    return tb - ta;
  });

  for (const msg of sorted) {
    if (!msg.messageType) continue;
    const key = normalizeMessageType(msg.messageType);
    const mapped = MESSAGE_TYPE_TO_SEND[key];
    if (mapped) return mapped;
    const direct = msg.messageType.trim();
    if (
      direct === 'SMS' ||
      direct === 'Email' ||
      direct === 'WhatsApp' ||
      direct === 'IG' ||
      direct === 'FB' ||
      direct === 'Live_Chat'
    ) {
      return direct as GhlSendChannelType;
    }
  }

  return null;
}
