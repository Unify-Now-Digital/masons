import { describe, expect, it } from 'vitest';
import { isAutomatedHandle, isYopaHandle, isYopaMessage } from './partnerHandles';

describe('YOPA', () => {
  it('detects the partner sender and subject', () => {
    expect(isYopaHandle('info@yourofficeandpa.co.uk')).toBe(true);
    expect(isYopaHandle('jane@gmail.com')).toBe(false);
    expect(isYopaMessage({ from_handle: 'x@gmail.com', subject: 'Sears Melvin Memorials: YOPA Msg from Jane' })).toBe(true);
    expect(isYopaMessage({ from_handle: 'x@gmail.com', subject: 'Re: your quote' })).toBe(false);
  });
});

describe('isAutomatedHandle', () => {
  it('no-reply style senders only', () => {
    expect(isAutomatedHandle('noreply@stripe.com')).toBe(true);
    expect(isAutomatedHandle('no-reply@accounts.google.com')).toBe(true);
    expect(isAutomatedHandle('mailer-daemon@googlemail.com')).toBe(true);
    expect(isAutomatedHandle('enquiries@namm.org')).toBe(false);
    expect(isAutomatedHandle('+447700900000')).toBe(false);
  });
});
