/**
 * Display labels for `orders.order_type` — supports DB values like "New Memorial"
 * and slug-style values such as `new-memorial`, `renovation`.
 */
export function formatOrderTypeLabel(raw: string | null | undefined): string {
  if (raw == null) return '—';
  const trimmed = String(raw).trim();
  if (trimmed === '') return '—';

  const normalized = trimmed.toLowerCase().replace(/[\s_]+/g, '-');
  if (normalized === 'new-memorial') return 'New Memorial';
  if (normalized === 'renovation') return 'Renovation';
  if (normalized === 'kerb-set') return 'Kerb Set';
  if (normalized === 'additional-inscription') return 'Additional Inscription';

  if (/[-_]/.test(trimmed)) {
    return trimmed
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** For UI logic that must treat slug and title-case the same (e.g. product photo). */
export function isNewMemorialOrderType(raw: string | null | undefined): boolean {
  if (raw == null || String(raw).trim() === '') return false;
  const n = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
  return n === 'new-memorial';
}
