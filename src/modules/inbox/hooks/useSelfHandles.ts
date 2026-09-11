import { useMemo } from 'react';
import { useGmailConnection } from './useGmailConnection';
import { useWhatsAppConnection } from './useWhatsAppConnection';
import { useChannelAccounts } from './useInboxChannels';
import { buildSelfHandles } from '../utils/selfHandles';

/** Org mailboxes / senders — exclude from inbox counterparty lists. */
export function useSelfHandles() {
  const { data: gmail } = useGmailConnection();
  const { data: whatsapp } = useWhatsAppConnection();
  const { data: channelAccounts } = useChannelAccounts();

  return useMemo(
    () =>
      buildSelfHandles({
        gmailAddress: gmail?.email_address,
        whatsappFrom: whatsapp?.whatsapp_from,
        channelAccounts,
      }),
    [gmail?.email_address, whatsapp?.whatsapp_from, channelAccounts]
  );
}
