import { describe, expect, it } from 'vitest';
import { messagePreviewText } from './messagePreviewText';

describe('messagePreviewText', () => {
  it('uses the message body ahead of an empty stored preview', () => {
    expect(messagePreviewText('  Can we move the install to Tuesday?  ', null)).toBe(
      'Can we move the install to Tuesday?',
    );
  });

  it('falls back to the subject and drops tags', () => {
    expect(messagePreviewText('<p>Hello</p>', 'Ignored when body exists')).toBe('Hello');
    expect(messagePreviewText('   ', 'Permit form')).toBe('Permit form');
    expect(messagePreviewText('', '')).toBe('');
  });
});
