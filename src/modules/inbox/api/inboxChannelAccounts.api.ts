import { supabase } from '@/shared/lib/supabase';
import type { InboxChannelAccount } from '../types/inbox.types';

export async function fetchChannelAccounts() {
  const { data, error } = await supabase
    .from('inbox_channel_accounts')
    .select('*')
    .order('channel', { ascending: true });

  if (error) throw error;
  return (data || []) as InboxChannelAccount[];
}
