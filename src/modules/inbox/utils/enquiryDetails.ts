import type { Json } from '@/shared/types/database.types';
import { detailsRecord, detailsNumber, detailsString } from '@/modules/inquiries/utils/display';
import { getJobEnquiryPrice } from '@/modules/jobsPipeline/utils/display';

/**
 * A quote enquiry's `details` (SearsMelvin memorial.html → create_quote), shaped for the
 * inbox enquiry card. Values are shown as stored; Mason corrects nothing here.
 */
export type QuoteEnquiryView = {
  id: string;
  name: string;
  type: string | null;
  colour: string | null;
  size: string | null;
  font: string | null;
  lettering: string | null;
  /** Only when a Kerb Infill line item exists (infillType/infillColour are written for every product). */
  infill: string | null;
  /** addonLineItems names minus the Kerb Infill line (carried by `infill`); legacy `addons` strings when there are no line items. */
  addons: string[];
  inscription: string | null;
  /** details.price in pounds (string or number); already includes the add-ons. */
  price: number | null;
  /** details.permit_fee in pounds; not included in price. */
  permitFee: number | null;
  /** price + permit_fee via getJobEnquiryPrice; null without a numeric price. */
  guideTotal: number | null;
  /** Stored https URL only. */
  imageUrl: string | null;
};

const FONT_LABELS: Record<string, string> = { traditional: 'Traditional', script: 'Script' };
const KERB_INFILL_LINE = /^kerb infill/i;

function text(details: Json | null, key: string): string | null {
  const value = detailsString(details, key)?.trim();
  return value ? value : null;
}

function capitalise(value: string | null): string | null {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : null;
}

function names(value: unknown, read: (item: unknown) => unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const name = read(item);
    return typeof name === 'string' && name.trim() ? [name.trim()] : [];
  });
}

/** Null when details carry no product name (legacy rows): the card skips them. */
export function parseQuoteEnquiry(enquiry: { id: string; details: Json | null }): QuoteEnquiryView | null {
  const { id, details } = enquiry;
  const name = text(details, 'name');
  if (!name) return null;

  const rec = detailsRecord(details);
  const lineNames = names(rec.addonLineItems, (item) =>
    item && typeof item === 'object' ? (item as Record<string, unknown>).name : null
  );
  const hasKerbInfillLine = lineNames.some((line) => KERB_INFILL_LINE.test(line));
  const addons =
    lineNames.length > 0
      ? lineNames.filter((line) => !KERB_INFILL_LINE.test(line))
      : names(rec.addons, (item) => item);

  const infill = hasKerbInfillLine
    ? [capitalise(text(details, 'infillType')), capitalise(text(details, 'infillColour'))]
        .filter(Boolean)
        .join(' · ') || null
    : null;

  const font = text(details, 'font');
  const image = text(details, 'image');

  return {
    id,
    name,
    type: text(details, 'type'),
    colour: text(details, 'colour'),
    size: text(details, 'size'),
    font: font ? FONT_LABELS[font.toLowerCase()] ?? capitalise(font) : null,
    lettering: capitalise(text(details, 'letterColour')),
    infill,
    addons,
    inscription: text(details, 'inscription'),
    price: detailsNumber(details, 'price'),
    permitFee: detailsNumber(details, 'permit_fee'),
    guideTotal: getJobEnquiryPrice({
      enquiry: {
        id,
        channel: 'quote',
        price: detailsString(details, 'price'),
        permit_fee: detailsString(details, 'permit_fee'),
      },
    }),
    imageUrl: image && /^https:\/\//i.test(image) ? image : null,
  };
}
