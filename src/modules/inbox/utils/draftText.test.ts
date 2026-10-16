import { describe, expect, it } from 'vitest';
import { cleanReplyDraft, greetingName } from './draftText';

describe('cleanReplyDraft', () => {
  it('fills a known name and never leaves square brackets', () => {
    const cleaned = cleanReplyDraft("Dear [Customer's Name],\n\nThanks for writing.", 'Danielle Pearson-Smith');
    expect(cleaned.text.startsWith('Hi Danielle,')).toBe(true);
    expect(cleaned.text).not.toMatch(/\[[^\]]*\]/);
    expect(cleaned.flagged).toBe(false);
  });

  it('falls back to Hi, and flags a placeholder when the name is unknown', () => {
    const cleaned = cleanReplyDraft('Dear [Customer],\n\nThanks for writing.', '+44 7845 846058');
    expect(cleaned.text.startsWith('Hi,')).toBe(true);
    expect(cleaned.text).not.toMatch(/\[[^\]]*\]/);
    expect(cleaned.flagged).toBe(true);
    expect(cleaned.note).toMatch(/Hi,/);
  });

  it('adds a greeting when the draft has none', () => {
    const cleaned = cleanReplyDraft("I'd like to confirm the Bath stone.", 'Rosina Findlay');
    expect(cleaned.text.startsWith('Hi Rosina,')).toBe(true);
    expect(greetingName('Rosina Findlay')).toBe('Rosina');
  });
});
