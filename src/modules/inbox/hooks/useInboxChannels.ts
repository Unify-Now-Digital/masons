import { useQuery } from '@tanstack/react-query';
import { fetchChannelAccounts } from '../api/inboxChannelAccounts.api';
import { inboxKeys } from './useInboxConversations';

export function useChannelAccounts() {
  return useQuery({
    queryKey: inboxKeys.channels.all,
    queryFn: fetchChannelAccounts,
  });
}
