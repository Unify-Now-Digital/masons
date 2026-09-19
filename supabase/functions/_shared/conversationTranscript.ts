/**
 * Transcript helpers for the inbox AI edge functions: the import-free half of
 * conversationText.ts (D-9). No imports and no Deno globals — a src/ vitest file
 * imports this module, so both `deno check` and app tsc type-check it.
 * conversationText.ts re-exports every symbol here.
 *
 * Every export here is a COPY from `inbox-ai-thread-summary/index.ts`, which is
 * NOT modified this cycle — migrating it onto this module is a backlog line.
 * Keep the copies behaviourally identical to their sources:
 *   MsgRow                          index.ts:33-43
 *   stripHtml                       index.ts:15-23
 *   buildTaggedTranscript           index.ts:529-532 (window) + :534-539 (line format);
 *                                   the keepHead > 0 branch is new (FR-012), not a copy
 */

/** Copy of index.ts:33-43. */
export interface MsgRow {
  id: string;
  conversation_id: string;
  sent_at: string | null;
  created_at: string;
  channel: string;
  direction: string;
  body_text: string | null;
  from_handle: string;
  to_handle: string;
}

export interface TranscriptOptions {
  /** Newest N messages kept for the prompt. */
  maxMessages: number;
  /** Hard cap on the joined transcript length, in characters. */
  charCap: number;
  /**
   * Oldest N messages kept ahead of the newest block; counts toward `maxMessages`.
   * Default 0 = newest `maxMessages` only (today's path, unchanged).
   */
  keepHead?: number;
}

/** Copy of index.ts:15-23. */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tagged transcript, oldest to newest within the window.
 * Window = newest `maxMessages` (index.ts:529-532); line format identical to
 * index.ts:534-539. Oldest whole lines are then dropped until the joined text
 * fits `charCap`; a lone line still over the cap is truncated rather than
 * dropped, so a non-empty thread never yields an empty transcript.
 * `keepHead` > 0 takes buildHeadAndNewestTranscript instead.
 */
export function buildTaggedTranscript(messages: MsgRow[], options: TranscriptOptions): string {
  const { maxMessages, charCap } = options;
  const keepHead = options.keepHead ?? 0;
  if (keepHead > 0) return buildHeadAndNewestTranscript(messages, maxMessages, charCap, keepHead);
  const forPrompt = messages.length > maxMessages ? messages.slice(-maxMessages) : messages;

  const lines = forPrompt.map((m) => {
    const raw = m.body_text ?? '';
    const text =
      m.channel === 'email' ? stripHtml(raw) || '(No message body)' : raw.trim() || '(No message body)';
    const ts = m.sent_at ?? m.created_at;
    return `[${m.channel}] [${m.direction}] ${ts} from=${m.from_handle} to=${m.to_handle}: ${text}`;
  });

  while (lines.length > 1 && lines.join('\n').length > charCap) {
    lines.shift();
  }

  const joined = lines.join('\n');
  return joined.length > charCap ? joined.slice(0, charCap) : joined;
}

/** Marks messages dropped between the kept head and the newest block. */
const GAP_LINE = '[…]';

/**
 * keepHead > 0 (FR-012): the oldest `keepHead` messages plus the newest
 * `maxMessages - keepHead`, so a thread's opening messages survive a long thread.
 * The window splits by index, so head and newest never overlap (de-duplicated).
 * `[…]` sits between them only when something was actually dropped, by the window
 * or by the trim (D-6). The trim drops the oldest of the newest block, never the
 * head, and the `[…]` line is counted before it so the trim cannot push it out
 * (D-7). If the head alone is still over `charCap`, the joined text is cut at
 * `charCap` exactly as the keepHead-0 path does (D-7).
 * D-6: `keepHead >= maxMessages` takes the first `maxMessages` and no tail.
 */
function buildHeadAndNewestTranscript(
  messages: MsgRow[],
  maxMessages: number,
  charCap: number,
  keepHead: number,
): string {
  // One message through the keepHead-0 path is exactly its tagged line, so the
  // line format is shared without editing that path.
  const toLine = (m: MsgRow) => buildTaggedTranscript([m], { maxMessages: 1, charCap: Infinity });

  const headCount = Math.min(keepHead, maxMessages);
  const tailCount = maxMessages - headCount;
  const head = messages.slice(0, headCount);
  let tail: MsgRow[] = [];
  if (messages.length <= maxMessages) tail = messages.slice(headCount);
  else if (tailCount > 0) tail = messages.slice(-tailCount); // D-6: never slice(-0)
  let dropped = messages.length > maxMessages;

  const headLines = head.map(toLine);
  const tailLines = tail.map(toLine);
  const assemble = () => [...headLines, ...(dropped ? [GAP_LINE] : []), ...tailLines].join('\n');

  while (tailLines.length > 0 && assemble().length > charCap) {
    tailLines.shift();
    dropped = true;
  }

  const joined = assemble();
  return joined.length > charCap ? joined.slice(0, charCap) : joined;
}
