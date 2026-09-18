import { afterEach, describe, expect, it, vi } from 'vitest';
import { readMinWidth, subscribeMinWidth } from './useMinWidth';

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    addEventListener: vi.fn((_type: string, cb: () => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_type: string, cb: () => void) => listeners.delete(cb)),
  };
  const matchMedia = vi.fn(() => mql);
  vi.stubGlobal('window', { matchMedia });
  return {
    matchMedia,
    mql,
    fire(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readMinWidth', () => {
  it('reads the initial value synchronously from the min-width query', () => {
    const { matchMedia } = stubMatchMedia(true);
    expect(readMinWidth(1280)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 1280px)');
  });

  it('returns false when the query does not match', () => {
    stubMatchMedia(false);
    expect(readMinWidth(1280)).toBe(false);
  });
});

describe('subscribeMinWidth', () => {
  it('notifies on change and the next read sees the new value', () => {
    const media = stubMatchMedia(false);
    const onChange = vi.fn();
    subscribeMinWidth(1280, onChange);

    media.fire(true);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(readMinWidth(1280)).toBe(true);
  });

  it('unsubscribe removes the listener', () => {
    const media = stubMatchMedia(false);
    const onChange = vi.fn();
    const unsubscribe = subscribeMinWidth(1280, onChange);

    unsubscribe();
    media.fire(true);

    expect(onChange).not.toHaveBeenCalled();
    expect(media.mql.removeEventListener).toHaveBeenCalledWith('change', onChange);
  });
});
