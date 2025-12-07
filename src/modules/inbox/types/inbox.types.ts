export interface Message {
  id: string;
  order_id: string | null;
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

