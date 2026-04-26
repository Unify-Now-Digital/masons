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
  /** Latest inbound message timestamp; populated by db trigger on inbox_messages insert. */
  last_inbound_at?: string | null;
  /** Latest outbound message timestamp; populated by db trigger on inbox_messages insert. */
  last_outbound_at?: string | null;
  created_at: string;
  updated_at: string;
  person_id?: string | null;
  /** FK to orders.id; set when an enquiry is converted to an order. */
  order_id?: string | null;
  /** Channel-native thread id, e.g. Gmail threadId. Joins to orders.permit_gmail_thread_id. */
  external_thread_id?: string | null;
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
  body_html?: string | null;
  subject: string | null;
  sent_at: string;
  status: 'sent' | 'delivered' | 'failed';
  message_type?: 'message' | 'internal_note';
  created_at: string;
  updated_at: string;
  meta?: Record<string, unknown> | null;
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
  /** Exact match on `primary_handle` (trimmed). Use with `unlinked_only` + `channel` for narrow unlinked timeline fetches. */
  primary_handle_exact?: string;
}

export type InboxChannel = 'email' | 'sms' | 'whatsapp';

export type ConversationIdByChannel = Record<InboxChannel, string | null>;

/** Linked customer: real `person_id`. Unlinked pseudo-customer: exact `primary_handle` on one channel. */
export type CustomerThreadRow =
  | {
      kind: 'linked';
      personId: string;
      displayName: string;
      latestMessageAt: string | null;
      latestPreview: string | null;
      unreadCount: number;
      hasUnread: boolean;
      channels: InboxChannel[];
      latestConversationIdByChannel: ConversationIdByChannel;
      /** Conversation with the newest `last_message_at` in this row (same as first entry of `sortedByRecent` in useCustomerThreads). */
      latestConversationId: string;
      conversationIds: string[];
    }
  | {
      kind: 'unlinked';
      channel: InboxChannel;
      /** Normalized (trimmed) handle; matches `inbox_conversations.primary_handle` for timeline queries. */
      handle: string;
      displayTitle: string;
      latestMessageAt: string | null;
      latestPreview: string | null;
      unreadCount: number;
      hasUnread: boolean;
      channels: [InboxChannel];
      latestConversationIdByChannel: ConversationIdByChannel;
      latestConversationId: string;
      conversationIds: string[];
    };

/** Customers-tab selection: linked person UUID or unlinked handle bucket. */
export type CustomersSelection =
  | { type: 'linked'; personId: string }
  | { type: 'unlinked'; channel: InboxChannel; handle: string };

export function customerThreadRowStableKey(row: CustomerThreadRow): string {
  if (row.kind === 'linked') return `linked:${row.personId}`;
  return `unlinked:${row.channel}:${encodeURIComponent(row.handle)}`;
}

export function customersSelectionFromRow(row: CustomerThreadRow): CustomersSelection {
  if (row.kind === 'linked') return { type: 'linked', personId: row.personId };
  return { type: 'unlinked', channel: row.channel, handle: row.handle };
}

export function customersSelectionsEqual(a: CustomersSelection | null, b: CustomersSelection | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'linked' && b.type === 'linked') return a.personId === b.personId;
  if (a.type === 'unlinked' && b.type === 'unlinked')
    return a.channel === b.channel && a.handle === b.handle;
  return false;
}
