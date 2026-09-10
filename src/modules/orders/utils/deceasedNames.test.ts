import { describe, expect, it } from 'vitest';
import {
  customerNameForOrderWrite,
  customerNameFromDeceased,
  deceasedInputFromLegacyName,
  getDeceasedDisplayName,
  getDeceasedNames,
  isLegacyDeceasedMissing,
  normalizeNameKey,
  wouldDeceasedEqualLiving,
} from './deceasedNames';

describe('normalizeNameKey', () => {
  it('trims and lowercases', () => {
    expect(normalizeNameKey('  Ada Lovelace  ')).toBe('ada lovelace');
  });
  it('treats null/undefined as empty', () => {
    expect(normalizeNameKey(null)).toBe('');
    expect(normalizeNameKey(undefined)).toBe('');
  });
});

describe('isLegacyDeceasedMissing / equal-name rule', () => {
  it('empty customer_name ⇒ missing', () => {
    expect(isLegacyDeceasedMissing('', 'Ada')).toBe(true);
    expect(isLegacyDeceasedMissing('   ', 'Ada')).toBe(true);
    expect(isLegacyDeceasedMissing(null, 'Ada')).toBe(true);
  });

  it('trim+casefold equal to person_name ⇒ missing (never invent)', () => {
    expect(isLegacyDeceasedMissing('Ada Lovelace', 'Ada Lovelace')).toBe(true);
    expect(isLegacyDeceasedMissing('  ada lovelace ', 'Ada Lovelace')).toBe(true);
  });

  it('distinct nonempty names ⇒ not missing', () => {
    expect(isLegacyDeceasedMissing('Charles Babbage', 'Ada Lovelace')).toBe(false);
  });

  it('nonempty customer with null/empty person ⇒ not missing', () => {
    expect(isLegacyDeceasedMissing('Charles Babbage', null)).toBe(false);
    expect(isLegacyDeceasedMissing('Charles Babbage', '')).toBe(false);
  });
});

describe('wouldDeceasedEqualLiving', () => {
  it('warns only when both nonempty and equal', () => {
    expect(wouldDeceasedEqualLiving('Ada', 'Ada')).toBe(true);
    expect(wouldDeceasedEqualLiving(' ada ', 'ADA')).toBe(true);
    expect(wouldDeceasedEqualLiving('Ada', 'Bob')).toBe(false);
    expect(wouldDeceasedEqualLiving('', 'Ada')).toBe(false);
    expect(wouldDeceasedEqualLiving('Ada', '')).toBe(false);
  });
});

describe('getDeceasedNames', () => {
  it('prefers order_deceased rows (primary first, then sort_order)', () => {
    expect(
      getDeceasedNames({
        order_deceased: [
          { full_name: 'Second', is_primary: false, sort_order: 1 },
          { full_name: 'Primary', is_primary: true, sort_order: 0 },
          { full_name: 'Third', is_primary: false, sort_order: 2 },
        ],
        customer_name: 'Legacy Ignored',
        person_name: 'Living',
      })
    ).toEqual(['Primary', 'Second', 'Third']);
  });

  it('falls back to legacy customer_name when distinct from person', () => {
    expect(
      getDeceasedNames({
        order_deceased: [],
        customer_name: 'Charles Babbage',
        person_name: 'Ada Lovelace',
      })
    ).toEqual(['Charles Babbage']);
  });

  it('equal-name legacy ⇒ empty (missing)', () => {
    expect(
      getDeceasedNames({
        customer_name: 'Ada Lovelace',
        person_name: 'Ada Lovelace',
      })
    ).toEqual([]);
  });

  it('empty order_deceased array still allows legacy fallback', () => {
    expect(
      getDeceasedNames({
        order_deceased: [],
        customer_name: 'Memorial Name',
        person_name: 'Living',
      })
    ).toEqual(['Memorial Name']);
  });
});

describe('getDeceasedDisplayName', () => {
  it('joins with amp and returns null when missing', () => {
    expect(
      getDeceasedDisplayName({
        order_deceased: [
          { full_name: 'A', is_primary: true },
          { full_name: 'B', is_primary: false },
        ],
      })
    ).toBe('A & B');
    expect(getDeceasedDisplayName({ customer_name: 'Ada', person_name: 'Ada' })).toBeNull();
  });
});

describe('deceasedInputFromLegacyName / dual-write helpers', () => {
  it('builds one primary row for distinct names', () => {
    expect(deceasedInputFromLegacyName('Charles', 'Ada')).toEqual([
      { full_name: 'Charles', is_primary: true, sort_order: 0 },
    ]);
  });

  it('returns [] for equal-name / empty', () => {
    expect(deceasedInputFromLegacyName('Ada', 'Ada')).toEqual([]);
    expect(deceasedInputFromLegacyName('', 'Ada')).toEqual([]);
  });

  it('customerNameFromDeceased uses primary; empty ⇒ ""', () => {
    expect(customerNameFromDeceased([])).toBe('');
    expect(
      customerNameFromDeceased([
        { full_name: 'A', is_primary: false },
        { full_name: 'B', is_primary: true },
      ])
    ).toBe('B');
  });

  it('customerNameForOrderWrite never null; equal ⇒ ""', () => {
    expect(customerNameForOrderWrite('Charles', 'Ada')).toBe('Charles');
    expect(customerNameForOrderWrite('Ada', 'Ada')).toBe('');
    expect(customerNameForOrderWrite(null, 'Ada')).toBe('');
  });
});
