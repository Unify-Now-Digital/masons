/**
 * One-click chase text the inbox composer already offers. Today reuses these
 * bodies for a prepared message. Nothing here is sent on its own.
 */
import type { InboxBucket } from './inboxBuckets';

export interface ChaseOption {
  id: string;
  label: string;
  /** Body text to drop into the composer. */
  body: string;
}

export function buildChaseOptions(
  bucket: InboxBucket,
  participantName: string | null,
): ChaseOption[] {
  const greetingName =
    (participantName?.trim() ?? '').split(/\s+/)[0] || (bucket === 'cemetery' ? '' : 'there');
  const sign = 'Kind regards,';

  // Permit chase templates removed (Oct 2026): no cemetery chase options.
  if (bucket === 'cemetery') return [];

  if (bucket === 'order') {
    return [
      {
        id: 'order-status-update',
        label: 'Status update',
        body:
          `Hi ${greetingName},\n\nQuick update on your order — wanted to keep you in the loop on where things are at. ` +
          `Happy to jump on a call if easier.\n\n${sign}`,
      },
      {
        id: 'order-deposit-reminder',
        label: 'Deposit reminder',
        body:
          `Hi ${greetingName},\n\nJust a gentle reminder that the deposit is needed before we can move the order forward. ` +
          `Let me know if you'd like the bank details resent.\n\n${sign}`,
      },
    ];
  }

  return [
    {
      id: 'enquiry-followup',
      label: 'Quote follow-up',
      body:
        `Hi ${greetingName},\n\nJust checking in on the quote we sent through — happy to answer any questions ` +
        `or tweak anything if it would help.\n\n${sign}`,
    },
    {
      id: 'enquiry-info-needed',
      label: 'Ask for details',
      body:
        `Hi ${greetingName},\n\nThanks for getting in touch. To put a quote together, could you let me know ` +
        `the cemetery, the inscription wording, and your preferred stone if you have one in mind?\n\n${sign}`,
    },
  ];
}
