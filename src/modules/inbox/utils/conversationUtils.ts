/**
 * Compute preview text from message body (first 120 chars, trimmed)
 * Used for updating conversation.last_message_preview
 */
import { formatDateTimeDMY } from '@/shared/lib/formatters';

export function computeMessagePreview(bodyText: string): string {
  return bodyText.trim().substring(0, 120);
}

/**
 * Format timestamp for display (gracefully handle null)
 * Returns "No messages" if timestamp is null/undefined
 */
export function formatConversationTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "No messages";

  // Standardize to absolute date-time for consistency across app.
  // (Avoid locale-dependent toLocaleDateString and relative-time outputs.)
  const out = formatDateTimeDMY(timestamp, { withTime: true, withSeconds: false, use12Hour: false });
  return out === '—' ? 'Invalid date' : out;
}

/**
 * Adaptive absolute timestamp for conversation LIST rows:
 * today -> "15:52", this year -> "8 Jul", older -> "8 Jul 2025".
 * Returns "" for null/undefined/invalid input.
 */
export function formatConversationListTimestamp(
  timestamp: string | null | undefined
): string {
  if (!timestamp) return "";

  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format message sent_at timestamp (gracefully handle null)
 */
export function formatMessageTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "Time unknown";

  const out = formatDateTimeDMY(timestamp, { withTime: true, withSeconds: false, use12Hour: false });
  return out === '—' ? 'Invalid date' : out;
}
