/** Collect payment pre-fill presets (InvoiceDetailSidebar; ?amount= deep link). */
export type CollectPreset = 'deposit' | 'full';

/** Pence to pre-fill for a preset: 50% of the invoice total (capped) or the whole remaining. */
/**
 * `depositPence`: the SM deposit (50% memorial + 100% permit, shared/lib/deposit) for the
 * invoice's orders. When it is unknown (0), falls back to 50% of the invoice total.
 */
export function collectPresetPence(
  preset: CollectPreset,
  invoiceTotalPence: number,
  remainingPence: number,
  depositPence = 0,
): number {
  if (remainingPence <= 0) return 0;
  if (preset === 'full') return remainingPence;
  const dep = depositPence > 0 ? Math.round(depositPence) : Math.round(Math.max(0, invoiceTotalPence) * 0.5);
  return Math.max(1, Math.min(dep > 0 ? dep : remainingPence, remainingPence));
}
