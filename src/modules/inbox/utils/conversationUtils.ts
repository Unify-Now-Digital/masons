/**
 * Compute preview text from message body (first 120 chars, trimmed)
 * Used for updating conversation.last_message_preview
 */
export function computeMessagePreview(bodyText: string): string {
  return bodyText.trim().substring(0, 120);
}

/**
 * Format timestamp for display (gracefully handle null)
 * Returns "No messages" if timestamp is null/undefined
 */
export function formatConversationTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "No messages";
  
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  
  // Format as relative time (e.g., "2 hours ago") or absolute date
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
  
  // Fallback to locale date string
  return date.toLocaleDateString();
}

/**
 * Format message sent_at timestamp (gracefully handle null)
 */
export function formatMessageTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "Time unknown";
  
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  
  return date.toLocaleString();
}
