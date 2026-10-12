import { useMemo } from 'react';
import { useGmailConnection } from './useGmailConnection';
import { useWhatsAppConnection } from './useWhatsAppConnection';
import { buildSelfHandles } from '../utils/selfHandles';

/** Org mailboxes / senders — exclude from inbox counterparty lists. */
export function useSelfHandles() {
  const { data: gmail } = useGmailConnection();
  const { data: whatsapp } = useWhatsAppConnection();
  // inbox_channel_accounts is not read: it has no organization_id, and
  // `authenticated` lost its grant in the SearsMelvin 2026-08-09 lock, so the
  // query only ever failed with 42501.

  return useMemo(
    () =>
      buildSelfHandles({
        gmailAddress: gmail?.email_address,
        whatsappFrom: whatsapp?.whatsapp_from,
      }),
    [gmail?.email_address, whatsapp?.whatsapp_from]
  );
}
