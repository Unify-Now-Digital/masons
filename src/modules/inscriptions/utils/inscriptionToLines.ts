import type { ProofLine } from '../api/proofRevisions.api';

const DEFAULT_FONT_SIZE = 24;

/**
 * Convert a raw inscription text (newline-delimited) into an initial line
 * structure for VisualProof. The y-coordinate is left at 0 — VisualProof's
 * computeLayout auto-spaces lines vertically within the stone shape.
 */
export function inscriptionTextToLines(text: string | null | undefined): ProofLine[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line, y: 0, fontSize: DEFAULT_FONT_SIZE }));
}

/** Reverse of `inscriptionTextToLines` — for editing the source text. */
export function linesToText(lines: ProofLine[]): string {
  return lines.map((l) => l.text).join('\n');
}
