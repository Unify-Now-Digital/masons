import { supabase } from '@/shared/lib/supabase';

export type EnquiryChannel = 'email' | 'sms' | 'whatsapp';

export interface EnquiryExtraction {
  orderType: string | null;
  customerName: string | null;
  customerPhone: string | null;
  cemeteryText: string | null;
  productText: string | null;
  inscriptionText: string | null;
  linkedOrderId: string | null;
  confidence: number | null;
  flags: string[];
  extractedAt: string | null;
}

export interface EnquiryItem {
  conversationId: string;
  channel: EnquiryChannel;
  fromHandle: string;
  primaryHandle: string;
  subject: string | null;
  preview: string | null;
  receivedAt: string | null;
  unreadCount: number;
  orderId: string | null;
  extraction: EnquiryExtraction | null;
}

export interface EnquiryPayload {
  items: EnquiryItem[];
  unsortedCount: number;
  highConfidenceCount: number;
}

export async function fetchEnquiries(organizationId: string): Promise<EnquiryPayload> {
  // Open conversations not yet linked to an order
  let conversations: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from('inbox_conversations')
      .select(
        'id, channel, primary_handle, subject, last_message_preview, last_message_at, unread_count, order_id',
      )
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) throw error;
    conversations = data ?? [];
  } catch {
    conversations = [];
  }

  if (conversations.length === 0) {
    return { items: [], unsortedCount: 0, highConfidenceCount: 0 };
  }

  // Get the latest inbound message per conversation for the "from" handle
  const conversationIds = conversations.map((c) => (c as { id: string }).id);
  let latestInbound: Record<string, { from_handle: string | null }> = {};
  try {
    const { data } = await supabase
      .from('inbox_messages')
      .select('conversation_id, from_handle, sent_at, direction')
      .in('conversation_id', conversationIds)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false });
    type Row = { conversation_id: string; from_handle: string | null; sent_at: string };
    for (const raw of data ?? []) {
      const r = raw as Row;
      if (!latestInbound[r.conversation_id]) {
        latestInbound[r.conversation_id] = { from_handle: r.from_handle };
      }
    }
  } catch {
    latestInbound = {};
  }

  // Extractions
  let extractionsByConversation: Record<string, EnquiryExtraction> = {};
  try {
    const { data } = await supabase
      .from('inbox_enquiry_extraction')
      .select(
        'conversation_id, order_type, customer_name, customer_phone, cemetery_text, product_text, inscription_text, linked_order_id, confidence, flags, extracted_at',
      )
      .in('conversation_id', conversationIds);
    type Row = {
      conversation_id: string;
      order_type: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      cemetery_text: string | null;
      product_text: string | null;
      inscription_text: string | null;
      linked_order_id: string | null;
      confidence: number | null;
      flags: string[] | null;
      extracted_at: string | null;
    };
    for (const raw of data ?? []) {
      const r = raw as Row;
      extractionsByConversation[r.conversation_id] = {
        orderType: r.order_type,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        cemeteryText: r.cemetery_text,
        productText: r.product_text,
        inscriptionText: r.inscription_text,
        linkedOrderId: r.linked_order_id,
        confidence: r.confidence,
        flags: r.flags ?? [],
        extractedAt: r.extracted_at,
      };
    }
  } catch {
    extractionsByConversation = {};
  }

  const items: EnquiryItem[] = conversations.map((raw) => {
    const r = raw as {
      id: string;
      channel: EnquiryChannel;
      primary_handle: string;
      subject: string | null;
      last_message_preview: string | null;
      last_message_at: string | null;
      unread_count: number | null;
      order_id: string | null;
    };
    return {
      conversationId: r.id,
      channel: r.channel,
      fromHandle: latestInbound[r.id]?.from_handle ?? r.primary_handle,
      primaryHandle: r.primary_handle,
      subject: r.subject,
      preview: r.last_message_preview,
      receivedAt: r.last_message_at,
      unreadCount: r.unread_count ?? 0,
      orderId: r.order_id,
      extraction: extractionsByConversation[r.id] ?? null,
    };
  });

  const unsorted = items.filter((i) => !i.orderId);
  const highConfidence = items.filter((i) => (i.extraction?.confidence ?? 0) > 90 && !i.orderId);

  return {
    items,
    unsortedCount: unsorted.length,
    highConfidenceCount: highConfidence.length,
  };
}
