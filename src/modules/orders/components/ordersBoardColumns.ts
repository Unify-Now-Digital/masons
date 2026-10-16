import type { OrderColumnDefinition } from './orderColumnDefinitions';

/** Minimum track so a label wraps inside its cell instead of painting over the next one. */
const COL_MIN: Record<string, number> = {
  customer: 120,
  nextStep: 100,
  product: 120,
  permit: 72,
  stoneStatus: 228,
  supplier: 136,
  proof: 88,
  progress: 136,
};

export function colTrack(id: string): string {
  const min = COL_MIN[id] ?? 80;
  switch (id) {
    case 'customer': return `minmax(${min}px,1.15fr)`;
    case 'nextStep': return `minmax(${min}px,1fr)`;
    case 'product': return `minmax(${min}px,1.05fr)`;
    case 'stoneStatus': return `minmax(${min}px,1.15fr)`;
    case 'supplier': return `minmax(${min}px,1.35fr)`;
    case 'progress': return `minmax(${min}px,1.2fr)`;
    default: return `minmax(${min}px,0.75fr)`;
  }
}

function columnsNeed(columns: OrderColumnDefinition[]): number {
  // 3px rail + 24px menu + a 16px gap between every track.
  return 3 + 24 + columns.reduce((sum, col) => sum + (COL_MIN[col.id] ?? 80), 0) + (columns.length + 1) * 16;
}

/** Drop wide columns until each remaining track can hold its text. Width 0 keeps the full set (no measurement yet). */
export function columnsForWidth(columns: OrderColumnDefinition[], width: number): OrderColumnDefinition[] {
  if (width <= 0) return columns;
  const drop = ['product', 'proof', 'progress'];
  let shown = columns;
  for (const id of drop) {
    if (columnsNeed(shown) <= width) break;
    shown = shown.filter((column) => column.id !== id);
  }
  return shown;
}
