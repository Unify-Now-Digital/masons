import { describe, expect, it } from 'vitest';
import { actionColour, nextActionStyle } from './nextAction';
import { nextActionForEnquiry, nextActionForOrder } from '@/shared/lib/nextAction';

describe('universal next-action language', () => {
  it('red = act now, amber = soon/money, blue = waiting, green = done', () => {
    expect(actionColour({ kind: 'follow', tone: 'red' })).toBe('red');
    expect(actionColour({ kind: 'follow', tone: 'neutral' })).toBe('amber');
    expect(actionColour({ kind: 'balance', tone: 'amber' })).toBe('amber');
    expect(actionColour({ kind: 'waiting', tone: 'neutral' })).toBe('blue');
    expect(actionColour({ kind: 'none', tone: 'neutral' })).toBe('green');
  });
  it('uses plain verbs', () => {
    expect(nextActionForEnquiry({ side: 'us' }).label).toBe('Reply');
    expect(nextActionForOrder({}).label).toBe('Request deposit');
    expect(nextActionStyle({ kind: 'deposit', tone: 'red', label: 'Chase' }).label).toBe('Chase');
    expect(nextActionStyle({ kind: 'balance', tone: 'amber' }).label).toBe('Request balance');
  });
  it('classes come from the light/dark token set', () => {
    expect(nextActionStyle({ kind: 'follow', tone: 'red' }).classes.solid).toContain('bg-gardens-na-red');
  });
});
