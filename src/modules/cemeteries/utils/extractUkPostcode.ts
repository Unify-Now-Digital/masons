// Pull a UK-shaped postcode out of an address string.
// Pattern: <area letters><district digit/letter>[ ]<sector digit><unit letters>
// e.g. "Barlow Moor Road, Manchester M21 7GL" -> "M21 7GL"
const UK_POSTCODE_RE = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/i;

export function extractUkPostcode(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(UK_POSTCODE_RE);
  if (!match) return null;
  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}
