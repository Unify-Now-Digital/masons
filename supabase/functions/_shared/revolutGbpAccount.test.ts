import { describe, expect, it } from 'vitest';
import { revolutGbpAccountId, SEARS_MELVIN_GBP_ACCOUNT_ID } from './revolutGbpAccount';

describe('revolutGbpAccountId', () => {
  it('uses a configured account id and never needs the accounts list', () => {
    expect(revolutGbpAccountId('  abc-123  ')).toBe('abc-123');
  });

  it('falls back to the Sears Melvin GBP account already on payment rows', () => {
    expect(revolutGbpAccountId(undefined)).toBe(SEARS_MELVIN_GBP_ACCOUNT_ID);
    expect(revolutGbpAccountId('   ')).toBe(SEARS_MELVIN_GBP_ACCOUNT_ID);
    expect(SEARS_MELVIN_GBP_ACCOUNT_ID).toBe('c131e465-7c43-43d3-9377-7e5d3291029d');
  });
});
