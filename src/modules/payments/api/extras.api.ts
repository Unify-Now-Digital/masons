import { supabase } from '@/shared/lib/supabase';

interface DetectExtrasResponse {
  detected: number;
  order_id?: string;
}

/**
 * Trigger AI detection of order extras from conversations.
 * Can scan a specific order or all orders with recent conversation activity.
 */
export async function detectOrderExtras(orderId?: string): Promise<DetectExtrasResponse> {
  const { data, error } = await supabase.functions.invoke<DetectExtrasResponse>(
    'detect-order-extras',
    {
      body: orderId ? { order_id: orderId } : {},
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to detect order extras');
  }

  return data ?? { detected: 0 };
}
