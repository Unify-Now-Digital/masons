import { describe, expect, it } from 'vitest';
import { isTestDeal, isTestPerson } from './testDeals';

const p = (first_name: string, last_name: string, email: string | null, is_test = false) => ({ first_name, last_name, email, is_test });

describe('isTestPerson', () => {
  it('excludes test and internal people seen in prod', () => {
    expect(isTestPerson(p('Eng', 'Grok CF Test', 'eng-grok-cf-test+20261001@unifynow.digital'))).toBe(true);
    expect(isTestPerson(p('Arin', 'Melvin', 'arinmelvin@gmail.com'))).toBe(true);
    expect(isTestPerson(p('matthew', 'sears', 'info@churchillmemorials.com'))).toBe(true);
    expect(isTestPerson(p('Giorgi', 'Kotchlamazashvili', 'kotchlamazashvili.giorgi@gmail.com'))).toBe(true);
    expect(isTestPerson(p('test', 'name', 'test@gmail.com'))).toBe(true);
    expect(isTestPerson(p('Seed', 'Testperson-B', 'seed.testperson.b@example.com'))).toBe(true);
    expect(isTestPerson(p('TEST', 'Ads Tracking', 'test+adstracking@searsmelvin.co.uk'))).toBe(true);
    expect(isTestPerson(p('Margaret', 'Thornton', 'm@x.com', true))).toBe(true);
  });
  it('keeps real families, including near-miss names', () => {
    expect(isTestPerson(p('PAOLA', 'FARINO', 'paolafarino@btinternet.com'))).toBe(false);
    expect(isTestPerson(p('Karin', 'Searson', 'karin@gmail.com'))).toBe(false);
    expect(isTestPerson(p('Theresa', 'Grossett', 'theresagrossett@gmail.com'))).toBe(false);
    expect(isTestPerson(p('Joanseaton133@gmail.com', '-', 'joanseaton133@gmail.com'))).toBe(false);
    expect(isTestPerson(null)).toBe(false);
  });
});

describe('isTestDeal', () => {
  it('falls back to the conversation handle', () => {
    expect(isTestDeal({ person: null, conversation: { id: 'c', primary_handle: 'x@unifynow.digital', channel: 'email' } })).toBe(true);
    expect(isTestDeal({ person: null, conversation: { id: 'c', primary_handle: '+447956490497', channel: 'sms' } })).toBe(false);
  });
});
