import { describe, expect, it } from 'vitest';
import { messagesForLoadedThread, suggestionForLoadedMessage } from './threadBinding';

describe('messagesForLoadedThread', () => {
  const david = [{ id: 'm-david', body: 'Hello from David' }];
  const anne = [{ id: 'm-anne', body: 'Hello from Anne' }];

  it('hides a thread that was loaded for someone else', () => {
    expect(messagesForLoadedThread('anne', 'david', david)).toEqual([]);
    expect(messagesForLoadedThread('anne', null, david)).toEqual([]);
  });

  it('shows messages only after they were fetched for the selected person', () => {
    expect(messagesForLoadedThread('anne', 'anne', anne)).toEqual(anne);
  });

  it('shows nothing when nothing is selected', () => {
    expect(messagesForLoadedThread(null, null, anne)).toEqual([]);
  });
});

describe('suggestionForLoadedMessage', () => {
  it('drops a suggestion that arrived for the previous message', () => {
    expect(suggestionForLoadedMessage('anne-msg', 'david-msg', 'Dear David')).toBeNull();
    expect(suggestionForLoadedMessage('anne-msg', null, 'Dear David')).toBeNull();
  });

  it('keeps the suggestion that belongs to the message on screen', () => {
    expect(suggestionForLoadedMessage('anne-msg', 'anne-msg', 'Dear Anne')).toBe('Dear Anne');
  });
});
