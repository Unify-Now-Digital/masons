import { describe, expect, it } from 'vitest';
import { deriveOrderStage } from './orderStage';

const stage = (proof_status: string | null, permit_status = 'pending', stone_status = 'NA') =>
  deriveOrderStage({ stone_status, proof_status, permit_status });

describe('deriveOrderStage', () => {
  it('matches the order_stage SQL read-back (20261013160000)', () => {
    expect(stage('Sent')).toBe('proof');
    expect(stage('Revision')).toBe('proof');
    expect(stage('Approved')).toBe('lettering');
    expect(stage('In_Progress')).toBe('proof');
    expect(stage('Not_Received')).toBe('design');
    expect(stage('Lettered', 'approved', 'In Stock')).toBe('install_ready');
  });

  it('puts NA and null at design, Received at proof', () => {
    expect(stage('NA')).toBe('design');
    expect(stage(null)).toBe('design');
    expect(stage('Received')).toBe('proof');
  });

  it('keeps Approved at lettering whatever the permit and stone', () => {
    expect(stage('Approved', 'approved', 'In Stock')).toBe('lettering');
  });

  it('splits Lettered by permit, then stone', () => {
    expect(stage('Lettered', 'form_sent')).toBe('permit');
    expect(stage('Lettered', 'not_started')).toBe('lettering');
    expect(stage('Lettered', 'approved', 'Ordered')).toBe('lettering');
  });
});
