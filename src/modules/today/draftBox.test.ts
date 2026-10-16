import { describe, expect, it } from 'vitest';
import { draftBoxSize } from './draftBox';

describe('draftBoxSize', () => {
  it('grows to the text and only scrolls past the cap', () => {
    expect(draftBoxSize(80)).toEqual({ height: 82, scroll: false });
    expect(draftBoxSize(278)).toEqual({ height: 280, scroll: false });
    expect(draftBoxSize(400)).toEqual({ height: 280, scroll: true });
  });
});
