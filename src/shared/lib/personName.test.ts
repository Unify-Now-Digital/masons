import { describe, expect, it } from 'vitest';
import { displayPersonName, tidyStoredName } from './personName';

describe('missing surname', () => {
  it('shows the first name with (no surname), never a trailing dot', () => {
    expect(displayPersonName('Dean', '.')).toBe('Dean (no surname)');
    expect(displayPersonName('Dean', '.')).not.toBe('Dean .');
    expect(displayPersonName('Dean', '-')).toBe('Dean (no surname)');
    expect(displayPersonName('Dean', '–')).toBe('Dean (no surname)');
    expect(displayPersonName('Dean', '•')).toBe('Dean (no surname)');
    expect(displayPersonName('Dean', ' . ')).toBe('Dean (no surname)');
    expect(displayPersonName('Dean', '')).toBe('Dean (no surname)');
    expect(displayPersonName('Dean', '   ')).toBe('Dean (no surname)');
    expect(displayPersonName('Dean', '2')).toBe('Dean 2');
    expect(tidyStoredName('Dean .')).toBe('Dean (no surname)');
    expect(tidyStoredName('Dean .')).not.toContain('Dean .');
    expect(tidyStoredName('Dean . .')).toBe('Dean (no surname)');
    expect(tidyStoredName('Dean •')).toBe('Dean (no surname)');
    expect(tidyStoredName('Mary Ann .')).toBe('Mary Ann (no surname)');
  });

  it('keeps a real surname and a phone stored as the first name', () => {
    expect(displayPersonName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(displayPersonName('07956013764', null)).toBe('07956013764');
    expect(tidyStoredName('Ada Lovelace')).toBe('Ada Lovelace');
  });
});
