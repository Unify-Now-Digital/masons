/** Collect payment pre-fill presets (InvoiceDetailSidebar; ?amount= deep link). */
export type CollectPreset = 'deposit' | 'full';

/** Pence to pre-fill for a preset: 50% of the invoice total (capped) or the whole remaining. */
export function collectPresetPence(preset: CollectPreset, invoiceTotalPence: number, remainingPence: number): number {
  if (remainingPence <= 0) return 0;
  if (preset === 'full') return remainingPence;
  const half = Math.round(Math.max(0, invoiceTotalPence) * 0.5);
  return Math.max(1, Math.min(half > 0 ? half : remainingPence, remainingPence));
}
