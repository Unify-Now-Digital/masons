/** One line of message text for an inbox row. Empty when there is nothing to show. */
export function messagePreviewText(body: string | null | undefined, subject?: string | null): string {
  const fromBody = (body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const text = fromBody || (subject ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
