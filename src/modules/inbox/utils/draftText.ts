import { tidyStoredName } from '@/shared/lib/personName';

const GREETING = /^(hi|hello|dear|good morning|good afternoon|good evening)\b/i;
const PLACEHOLDER = /\[[^\]\n]{0,80}\]/g;

export interface CleanDraft {
  text: string;
  /** True when a [placeholder] could not be filled with a known name. */
  flagged: boolean;
  note: string | null;
}

/** First word of a stored person name. A phone or email is not a greeting name. */
export function greetingName(name?: string | null): string {
  const tidy = tidyStoredName(name);
  const first = tidy.split(/\s+/).filter(Boolean)[0] ?? '';
  if (!first || first.startsWith('+') || first.includes('@') || /^\d/.test(first)) return '';
  return first;
}

/**
 * Drafts shown in the composer never keep [brackets]. A known name fills them.
 * Otherwise the greeting is "Hi," and the draft is flagged.
 * A draft with no greeting gets one.
 */
export function cleanReplyDraft(raw: string, name?: string | null): CleanDraft {
  const first = greetingName(name);
  let hadPlaceholder = false;
  let text = raw.replace(PLACEHOLDER, () => {
    hadPlaceholder = true;
    return first;
  });
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(?:dear|hi|hello)\b[^,\n]*,/i, first ? `Hi ${first},` : 'Hi,')
    .trim();
  if (!GREETING.test(text)) {
    const hello = first ? `Hi ${first},` : 'Hi,';
    text = text ? `${hello}\n\n${text}` : hello;
  }
  const unfilled = hadPlaceholder && !first;
  return {
    text,
    flagged: unfilled,
    note: unfilled ? 'The name was missing, so this draft starts with Hi,.' : null,
  };
}
