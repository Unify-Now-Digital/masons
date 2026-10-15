import { describe, expect, it } from 'vitest';
import { previewFromMessages } from './previewFromMessages';

describe('previewFromMessages', () => {
  it('uses the newest non-empty body, including html when plain text is blank', () => {
    const map = previewFromMessages([
      { conversation_id: 'a', body_text: '', body_html: '<p>Older html</p>', sent_at: '2026-10-01T00:00:00Z' },
      { conversation_id: 'a', body_text: 'Latest plain', sent_at: '2026-10-02T00:00:00Z' },
      { conversation_id: 'b', body_text: '   ', body_html: '<p>Hello <b>there</b></p>', subject: 'Ignored', sent_at: '2026-10-03T00:00:00Z' },
      { conversation_id: 'c', body_text: '', subject: '', sent_at: '2026-10-04T00:00:00Z' },
    ]);
    expect(map.get('a')).toBe('Latest plain');
    expect(map.get('b')).toBe('Hello there');
    expect(map.has('c')).toBe(false);
  });
});
