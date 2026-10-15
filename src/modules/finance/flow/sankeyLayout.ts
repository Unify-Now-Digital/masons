/** Sankey geometry for the Finance lead-flow chart. Pure aside from label measurement. */

export const LABEL_PX = 14;
export const NODE_W = 16;
export const LABEL_GAP = 6;
/** Space between stacked nodes. Tighter than the old 20px so a short chart still separates labels. */
export const NODE_GAP = 8;
const EDGE_PAD = 10;
/** Room under the node stack so the last label (and its stroke) stays inside the view. */
export const LABEL_PAD = 24;

/** Height follows the busiest column, and stays in the 300–340px band. */
export function sankeyHeight(maxNodes: number): number {
  const n = Math.max(1, maxNodes);
  return Math.min(340, Math.max(300, 220 + n * 28));
}

/** Baseline for a node label, kept clear of the bottom edge of the view. */
export function labelBaseline(nodeY: number, nodeH: number, viewH: number): number {
  const raw = nodeY + Math.min(nodeH / 2, 18) + 5;
  return Math.min(raw, Math.max(12, viewH - 8));
}

/** Width when the canvas cannot measure (no document, or a zero-width font). */
export function estimateLabelWidth(name: string, stats: string, fontSize = LABEL_PX): number {
  return Math.ceil(name.length * fontSize * 0.62 + 5 + stats.length * fontSize * 0.56);
}

let measureCanvas: HTMLCanvasElement | null = null;

/**
 * Width of a node label: bold name, then the count / share / value.
 * Uses the canvas so the right margin matches the text that is actually drawn.
 */
export function measureLabelWidth(name: string, stats: string, fontSize = LABEL_PX): number {
  const estimate = estimateLabelWidth(name, stats, fontSize);
  if (typeof document === 'undefined') return estimate;
  try {
    measureCanvas ??= document.createElement('canvas');
    const ctx = measureCanvas.getContext('2d');
    if (!ctx) return estimate;
    ctx.font = `700 ${fontSize}px "DM Sans", sans-serif`;
    const nameW = ctx.measureText(name).width;
    ctx.font = `400 ${fontSize}px "DM Sans", sans-serif`;
    const statsW = ctx.measureText(stats).width;
    if (!(nameW > 0) && !(statsW > 0)) return estimate;
    // A few pixels over the canvas width, so a fallback font before DM Sans loads does not clip the label.
    return Math.ceil(nameW + 5 + statsW + 6);
  } catch {
    return estimate;
  }
}

export function labelStats(count: number, total: number, value: number, money: (n: number) => string): string {
  const share = `${count} · ${Math.round((count / (total || 1)) * 100)}%`;
  return value ? `${share} · ${money(value)}` : share;
}

/**
 * Three node columns across `cardWidth`. The right margin is the measured
 * right-hand label (node + gap + text + a small pad), so the last column sits
 * near the right edge. If the labels cannot fit, the view grows and the chart scrolls.
 */
export function columnXs(
  cardWidth: number,
  labelWidths: [number, number, number],
): { x: [number, number, number]; width: number; rightMargin: number } {
  const slot = (label: number) => NODE_W + LABEL_GAP + Math.max(0, label) + EDGE_PAD;
  const need = labelWidths.map(slot) as [number, number, number];
  const left = 4;
  let right = cardWidth - need[2];
  let mid = left + (right - left) / 2;
  let width = cardWidth;

  const overlaps = mid < left + need[0] + 4 || mid + need[1] > right - 4;
  if (overlaps) {
    const total = need[0] + need[1] + need[2];
    if (left + total <= cardWidth) {
      const slack = cardWidth - left - total;
      mid = left + need[0] + slack / 2;
      right = cardWidth - need[2];
    } else {
      mid = left + need[0];
      right = mid + need[1];
      width = Math.ceil(right + need[2]);
    }
  }
  if (right <= mid) {
    right = mid + NODE_W + EDGE_PAD;
    width = Math.max(width, Math.ceil(right + need[2]));
  }
  return { x: [left, mid, right], width, rightMargin: need[2] };
}
