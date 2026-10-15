import { describe, expect, it } from 'vitest';
import { stageGlyph, stageHoverRows, stagePresentation, stageTone, type GlyphState } from './stageTone';

const NOW = new Date('2026-10-15T12:00:00Z');
const GLYPHS: GlyphState[] = ['done', 'preapproved', 'needs', 'waiting', 'overdue', 'none'];

describe('stageGlyph', () => {
  it('maps every state to a symbol and tone', () => {
    expect(GLYPHS.map((state) => [state, stageGlyph(state).symbol, stageGlyph(state).tone])).toEqual([
      ['done', '✓', 'done'],
      ['preapproved', '★', 'done'],
      ['needs', '●', 'needs'],
      ['waiting', '◷', 'waiting'],
      ['overdue', '!', 'overdue'],
      ['none', '○', 'none'],
    ]);
  });
});

describe('stagePresentation', () => {
  it('omits a date when the field is empty and never prints a placeholder', () => {
    const approved = stagePresentation({ permitStatus: 'approved' }, 'permit', NOW);
    expect(approved.word).toBe('Approved');
    expect(approved.detail).toBeNull();

    const ordered = stagePresentation({ stoneStatus: 'Ordered' }, 'stone', NOW);
    expect(ordered.word).toBe('Ordered');
    expect(ordered.detail).toBeNull();

    const family = stagePresentation({ permitStatus: 'form_sent', permitFormSentAt: '2026-10-03' }, 'permit', NOW);
    expect(family.word).toBe('Family');
    expect(family.detail).toBe('3 Oct');
    expect(family.aria).toBe('Permit: family, 3 October');
  });

  it('adds the year only when the date is not in the current year', () => {
    const prior = stagePresentation({ permitStatus: 'approved', permitApprovedAt: '2025-10-03' }, 'permit', NOW);
    expect(prior.detail).toBe('3 Oct 2025');
    const current = stagePresentation({ permitStatus: 'pending', permitSubmittedAt: '2026-10-01' }, 'permit', NOW);
    expect(current.detail).toBe('1 Oct');
  });

  it('shows the proof upload date instead of the version when one is stored', () => {
    const view = stagePresentation({
      proofStatus: 'Sent',
      proofVersion: 3,
      proofUploadedAt: '2026-10-01',
      inscriptionText: 'In loving memory',
    }, 'proof', NOW);
    expect(view.detail).toBe('1 Oct');
    expect(view.detailBold).toBe(false);
  });

  it('escalates proof version 3 to needs and bolds the version', () => {
    const view = stagePresentation({
      proofStatus: 'Sent',
      proofVersion: 3,
      inscriptionText: 'In loving memory',
    }, 'proof', NOW);
    expect(view.tone).toBe('needs');
    expect(view.detail).toBe('v3');
    expect(view.detailBold).toBe(true);
  });

  it('hides hover rows that have no value', () => {
    const rows = stageHoverRows({ permitStatus: 'pending', cemeteryName: 'Highgate' }, 'permit');
    expect(rows.map((row) => row.label)).toEqual(['Cemetery']);
    const stone = stageHoverRows({ stoneStatus: 'Ordered' }, 'stone');
    expect(stone).toEqual([]);
    const proof = stageHoverRows({ proofStatus: 'NA' }, 'proof');
    expect(proof).toEqual([{ label: 'Inscription', value: 'Not recorded' }]);
  });
});

describe('stageTone', () => {
  it('marks a pre-approved permit done and a late stone overdue', () => {
    expect(stageTone({ permitStatus: 'not_started', permitPreapproved: true }, 'permit', NOW)).toBe('done');
    expect(stageTone({ stoneStatus: 'NA', depositDate: '2026-09-01' }, 'stone', NOW)).toBe('overdue');
    expect(stageTone({ stoneStatus: 'NA', depositDate: '2026-10-10' }, 'stone', NOW)).toBe('needs');
    expect(stageTone({ permitStatus: 'pending' }, 'permit', NOW)).toBe('waiting');
  });
});
