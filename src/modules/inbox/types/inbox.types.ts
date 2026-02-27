// Legacy Message type (kept for backward compatibility - other modules may use it)
export interface Message {
  id: string;
  order_id: string | null;
  company_id: string | null;
  thread_id: string | null;
  type: 'email' | 'phone' | 'note' | 'internal';
  direction: 'inbound' | 'outbound';
  from_name: string;
  from_email: string | null;
  from_phone: string | null;
  subject: string | null;
  content: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export type MessageInsert = Omit<Message, 'id' | 'created_at' | 'updated_at'>;
export type MessageUpdate = Partial<MessageInsert>;

// New Inbox Types (for inbox_conversations, inbox_messages, inbox_channel_accounts tables)
export interface InboxConversation {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  primary_handle: string;
  subject: string | null;
  status: 'open' | 'archived' | 'closed';
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  person_id?: string | null;
  link_state?: 'linked' | 'unlinked' | 'ambiguous';
  link_meta?: { candidates?: string[]; matched_on?: 'email' | 'phone' };
  user_id?: string | null;
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  from_handle: string;
  to_handle: string;
  body_text: string;
  subject: string | null;
  sent_at: string;
  status: 'sent' | 'delivered' | 'failed';
  created_at: string;
  updated_at: string;
  user_id?: string | null;
  gmail_connection_id?: string | null;
}

export interface InboxChannelAccount {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  account_identifier: string;
  is_connected: boolean;
  connection_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Insert/Update types
export type InboxConversationInsert = Omit<InboxConversation, 'id' | 'created_at' | 'updated_at'>;
export type InboxConversationUpdate = Partial<InboxConversationInsert>;
export type InboxMessageInsert = Omit<InboxMessage, 'id' | 'created_at' | 'updated_at'>;
export type InboxChannelAccountInsert = Omit<InboxChannelAccount, 'id' | 'created_at' | 'updated_at'>;

// Filter types
export interface ConversationFilters {
  status?: 'open' | 'archived' | 'closed';
  channel?: 'email' | 'sms' | 'whatsapp';
  unread_only?: boolean;
  search?: string;
  person_id?: string | null;
  unlinked_only?: boolean;
}
