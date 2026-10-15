import { describe, expect, it } from 'vitest';
import { stageShortLabel } from './stageTone';

const permit = [
  'approved',
  'pending',
  'form_sent',
  'customer_completed',
  'ready_to_submit',
  'returned_incomplete',
  'not_started',
  'NA',
  '',
  null,
  undefined,
] as const;

const stone = ['In Stock', 'Ordered', 'NA', '', null, undefined] as const;
const proof = [
  'Approved',
  'Lettered',
  'Sent',
  'Not_Received',
  'Received',
  'In_Progress',
  'Revision',
  'NA',
  '',
  null,
  undefined,
] as const;

describe('stageShortLabel', () => {
  it('covers every stored permit, stone and proof status', () => {
    for (const status of permit) expect(stageShortLabel('permit', status).length).toBeLessThanOrEqual(16);
    for (const status of stone) expect(stageShortLabel('stone', status).length).toBeLessThanOrEqual(16);
    for (const status of proof) expect(stageShortLabel('proof', status).length).toBeLessThanOrEqual(16);
    expect(stageShortLabel('permit', 'approved')).toBe('Approved');
    expect(stageShortLabel('permit', 'pending')).toBe('Council');
    expect(stageShortLabel('permit', 'form_sent')).toBe('Family');
    expect(stageShortLabel('permit', 'customer_completed')).toBe('Submit');
    expect(stageShortLabel('permit', 'not_started')).toBe('Send form');
    expect(stageShortLabel('stone', 'In Stock')).toBe('Delivered');
    expect(stageShortLabel('stone', 'Ordered')).toBe('Ordered');
    expect(stageShortLabel('stone', 'NA')).toBe('Order');
    expect(stageShortLabel('stone', 'NA', { overdue: true })).toBe('Order now');
    expect(stageShortLabel('proof', 'Sent')).toBe('Family');
    expect(stageShortLabel('proof', 'NA')).toBe('Drafting');
    expect(stageShortLabel('proof', 'Approved')).toBe('Approved');
  });

  it('returns Pre-approved for a standing cemetery approval', () => {
    expect(stageShortLabel('permit', 'not_started', { preapproved: true })).toBe('Pre-approved');
  });
});
