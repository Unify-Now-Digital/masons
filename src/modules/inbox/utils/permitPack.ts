import type { Order } from '@/modules/orders/types/orders.types';
import { getOrderPermitCost } from '@/modules/orders/utils/orderCalculations';

export type Tone = 'green' | 'amber' | 'red' | 'grey';
export interface PackItem {
  label: string;
  value: string;
  tone: Tone;
}


/** Columns not in the schema yet (migration written, not applied): shown as a placeholder. */
export const NOT_CAPTURED = 'Not captured yet';

function readField(order: Order, key: string): unknown {
  return (order as unknown as Record<string, unknown>)[key];
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * The essentials of a cemetery permit pack (Arin 2026-10-14): deceased name/dates,
 * inscription agreed, plot/section, grave owner/deed, fee paid. Reads the new columns
 * from migration 20261014_permit_pack_fields when they exist; placeholder otherwise.
 */
export function permitPackItems(order: Order): PackItem[] {
  const deceased = str(order.person_name);
  const dob = str(readField(order, 'deceased_dob'));
  const dod = str(readField(order, 'deceased_dod'));
  const inscStatus = str(readField(order, 'inscription_status'));
  const inscText = str(order.inscription_text);
  const plot = str(order.location);
  const section = str(readField(order, 'cemetery_section'));
  const owner = str(readField(order, 'grave_owner_name'));
  const deed = str(readField(order, 'deed_number'));
  const feePaidAt = str(readField(order, 'permit_fee_paid_to_cemetery_at'));
  const depositIn = !!str(order.deposit_date);
  const permit = getOrderPermitCost(order);

  const agreed = inscStatus != null && /^(agreed|approved|signed_off|confirmed)$/i.test(inscStatus);
  return [
    {
      label: 'Deceased',
      value: [deceased ?? 'Name missing', dob || dod ? `${dob ?? '?'} – ${dod ?? '?'}` : `dates: ${NOT_CAPTURED}`].join(' · '),
      tone: !deceased ? 'red' : dob && dod ? 'green' : 'grey',
    },
    {
      label: 'Inscription agreed',
      value: agreed ? 'Agreed' : inscText ? 'Drafted, not marked agreed' : 'No wording yet',
      tone: agreed ? 'green' : inscText ? 'amber' : 'red',
    },
    {
      label: 'Plot / section',
      value: `${plot ?? 'Plot missing'} · section: ${section ?? NOT_CAPTURED}`,
      tone: !plot ? 'red' : section ? 'green' : 'grey',
    },
    {
      label: 'Grave owner / deed',
      value: owner || deed ? `${owner ?? '?'} · deed ${deed ?? '?'}` : NOT_CAPTURED,
      tone: owner && deed ? 'green' : owner || deed ? 'amber' : 'grey',
    },
    {
      label: 'Fee paid',
      value: feePaidAt
        ? `Paid to cemetery ${feePaidAt.slice(0, 10)}`
        : depositIn
          ? `Deposit in (incl. £${permit.toFixed(2)} permit) · paid to cemetery: ${NOT_CAPTURED}`
          : `Deposit not paid (permit £${permit.toFixed(2)})`,
      tone: feePaidAt ? 'green' : depositIn ? 'amber' : 'red',
    },
  ];
}

