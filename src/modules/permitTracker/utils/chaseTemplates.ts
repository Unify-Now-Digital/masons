import type { PermitOrder, Cemetery, ChaseTarget, ChaseContext, ChaseEmailDraft } from '../types/permitTracker.types';
import { formatPermitDate } from './permitDays';

/**
 * Generate a chase email draft based on target, context, and order data.
 */
export function getChaseDraft(
  target: ChaseTarget,
  context: ChaseContext,
  orders: PermitOrder[],
  cemetery: Cemetery | null,
  senderName: string = 'Arin Melvin',
): ChaseEmailDraft {
  const order = orders[0];
  const cemeteryName = cemetery?.name ?? order?.location ?? 'the cemetery';
  const cemeteryEmail = cemetery?.primary_email ?? order?.permit_cemetery_email ?? '';

  if (target === 'cemetery' && context === 'multi') {
    return getCemeteryMultiDraft(orders, cemeteryName, cemeteryEmail, senderName);
  }

  if (target === 'cemetery') {
    return getCemeterySingleDraft(order, cemeteryName, cemeteryEmail, senderName);
  }

  if (target === 'customer' && order.permit_status === 'form_sent') {
    return getCustomerChaseDraft(order, cemeteryName, senderName);
  }

  return getCustomerRequestDraft(order, cemeteryName, senderName);
}

function getCemeterySingleDraft(
  order: PermitOrder,
  cemeteryName: string,
  cemeteryEmail: string,
  senderName: string,
): ChaseEmailDraft {
  const deceasedName = order.person_name ?? 'the deceased';
  const submittedDate = formatPermitDate(order.permit_submitted_at);
  const orderRef = order.order_number ? `ORD-${String(order.order_number).padStart(4, '0')}` : order.id.slice(0, 8);

  return {
    to: cemeteryEmail,
    subject: `Permit application — ${deceasedName} — update request`,
    body: `Dear ${cemeteryName} Permits,

I am writing to follow up on our permit application for the memorial of ${deceasedName}, submitted on ${submittedDate}.

We would be grateful for any update on the current status or expected decision date.

Kind regards,
${senderName}
Churchill Memorials
Ref: ${orderRef}`,
  };
}

function getCemeteryMultiDraft(
  orders: PermitOrder[],
  cemeteryName: string,
  cemeteryEmail: string,
  senderName: string,
): ChaseEmailDraft {
  const orderLines = orders.map((o) => {
    const name = o.person_name ?? 'Unknown';
    const date = formatPermitDate(o.permit_submitted_at);
    const ref = o.order_number ? `ORD-${String(o.order_number).padStart(4, '0')}` : o.id.slice(0, 8);
    return `• ${name} — submitted ${date} — ref ${ref}`;
  }).join('\n');

  return {
    to: cemeteryEmail,
    subject: `Permit applications update request — Churchill Memorials`,
    body: `Dear ${cemeteryName},

I am writing to request an update on the following outstanding permit applications:

${orderLines}

We would be grateful for any update you are able to provide on the current status of each application.

Kind regards,
${senderName}
Churchill Memorials`,
  };
}

function getCustomerChaseDraft(
  order: PermitOrder,
  cemeteryName: string,
  senderName: string,
): ChaseEmailDraft {
  const customerName = order.customer_name;
  const deceasedName = order.person_name ?? 'the deceased';
  const sentDate = formatPermitDate(order.permit_form_sent_at);

  return {
    to: order.customer_email ?? '',
    subject: `Memorial permit form — action required — ${deceasedName}`,
    body: `Dear ${customerName},

I am following up regarding the permit application form we sent you on ${sentDate} for ${deceasedName}'s memorial at ${cemeteryName}.

Please could you sign and return the form at your earliest convenience so we can submit the application to the cemetery.

If you have any questions or difficulty with the form, please do not hesitate to contact us.

Kind regards,
${senderName}
Churchill Memorials`,
  };
}

function getCustomerRequestDraft(
  order: PermitOrder,
  cemeteryName: string,
  senderName: string,
): ChaseEmailDraft {
  const customerName = order.customer_name;
  const deceasedName = order.person_name ?? 'the deceased';

  return {
    to: order.customer_email ?? '',
    subject: `Memorial permit — additional document required — ${deceasedName}`,
    body: `Dear ${customerName},

I am writing regarding the permit application for ${deceasedName}'s memorial at ${cemeteryName}.

The cemetery has requested an additional document before they can proceed with the application. Could you please provide [SPECIFY DOCUMENT] at your earliest convenience so we can keep the application moving.

Please do not hesitate to call if you have any questions.

Kind regards,
${senderName}
Churchill Memorials`,
  };
}
