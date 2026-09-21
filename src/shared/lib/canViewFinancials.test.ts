import { describe, expect, it } from 'vitest';
import { canViewFinancials } from './canViewFinancials';

describe('canViewFinancials', () => {
  it('is true for admin', () => {
    expect(canViewFinancials('admin')).toBe(true);
  });

  it('is true for member', () => {
    expect(canViewFinancials('member')).toBe(true);
  });

  it('is false for staff', () => {
    expect(canViewFinancials('staff')).toBe(false);
  });

  it('is false for an unknown role string', () => {
    expect(canViewFinancials('owner')).toBe(false);
  });

  it('is false for null', () => {
    expect(canViewFinancials(null)).toBe(false);
  });

  it('is false for undefined', () => {
    expect(canViewFinancials(undefined)).toBe(false);
  });
});
