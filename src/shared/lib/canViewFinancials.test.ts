import { describe, expect, it } from 'vitest';
import { canViewFinancials } from './canViewFinancials';

describe('canViewFinancials', () => {
  it('is true only for the owner flag', () => {
    expect(canViewFinancials(true)).toBe(true);
  });

  it('is false when the flag is off', () => {
    expect(canViewFinancials(false)).toBe(false);
  });

  it('is false for null', () => {
    expect(canViewFinancials(null)).toBe(false);
  });

  it('is false for undefined', () => {
    expect(canViewFinancials(undefined)).toBe(false);
  });
});
