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

  it('owner-locked org: admin and member do not see money', () => {
    expect(canViewFinancials(false, true, 'admin')).toBe(false);
    expect(canViewFinancials(false, true, 'member')).toBe(false);
  });

  it('org with no owner keeps the old rule', () => {
    expect(canViewFinancials(false, false, 'admin')).toBe(true);
    expect(canViewFinancials(false, false, 'member')).toBe(true);
    expect(canViewFinancials(false, false, 'staff')).toBe(false);
  });

  it('fails closed when owner status is unknown', () => {
    expect(canViewFinancials(false, null, 'admin')).toBe(false);
    expect(canViewFinancials(false, undefined, 'admin')).toBe(false);
  });
});
