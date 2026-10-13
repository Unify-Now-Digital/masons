import { describe, expect, it } from 'vitest';
import type { JobInvoiceSummary, PipelineJob } from '../types/jobsPipeline.types';
import { columnSummary, filterJobs, isGoneQuiet, jobNextStep, jobValueLabel, quietText, shouldFlagMoveToInvoiced, upNext } from './pipelineView';

const NOW = new Date('2026-10-14T10:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const job = (id: string, stage: PipelineJob['stage'], ageDays: number, price: string | null = null, source = 'email'): PipelineJob =>
  ({
    id, stage, source, created_at: daysAgo(ageDays + 1), updated_at: daysAgo(ageDays),
    enquiry: price ? { id: 'e' + id, channel: 'quote', price, permit_fee: null } : null,
    person: null, conversation: null,
  }) as unknown as PipelineJob;

describe('pipelineView', () => {
  it('quiet rule per stage: enquired 2d, quoted 14d, invoiced 7d', () => {
    expect(isGoneQuiet(job('a', 'enquired', 3), NOW)).toBe(true);
    expect(isGoneQuiet(job('a', 'enquired', 1), NOW)).toBe(false);
    expect(isGoneQuiet(job('b', 'quoted', 13), NOW)).toBe(false);
    expect(isGoneQuiet(job('b', 'quoted', 60), NOW)).toBe(true);
    expect(isGoneQuiet(job('c', 'confirmed', 99), NOW)).toBe(false);
  });
  it('timer in words', () => {
    expect(quietText(job('a', 'enquired', 3), NOW)).toEqual({ text: 'No reply · 3d', tone: 'over' });
    expect(quietText(job('b', 'quoted', 75), NOW)).toEqual({ text: 'Quiet 2mo', tone: 'over' });
    expect(quietText(job('b', 'quoted', 2), NOW)).toEqual({ text: '2d ago', tone: 'neutral' });
  });
  it('honest value labels', () => {
    expect(jobValueLabel(job('a', 'enquired', 1), undefined)).toBe('Not quoted yet');
    expect(jobValueLabel(job('b', 'quoted', 1), undefined)).toBe('Price not recorded');
    expect(jobValueLabel(job('c', 'quoted', 1, '3800'), undefined)).toBeNull();
  });
  it('next step per stage; quoted with an invoice flags the move', () => {
    const inv: JobInvoiceSummary = { count: 1, totalAmount: 2485 };
    expect(jobNextStep(job('a', 'enquired', 3), undefined, NOW)).toMatchObject({ label: 'Reply to enquiry', tone: 'red' });
    expect(jobNextStep(job('b', 'quoted', 1), undefined, NOW)).toMatchObject({ label: 'Chase quote', tone: 'neutral' });
    expect(jobNextStep(job('b', 'quoted', 1), inv, NOW).label).toBe('Chase deposit');
    expect(shouldFlagMoveToInvoiced(job('b', 'quoted', 1), inv)).toBe(true);
    expect(jobNextStep(job('c', 'invoiced', 9), inv, NOW)).toMatchObject({ label: 'Chase deposit', tone: 'red' });
    expect(jobNextStep(job('d', 'confirmed', 1), inv, NOW).kind).toBe('none');
  });
  it('column totals and weighted value', () => {
    const s = columnSummary('quoted', [job('a', 'quoted', 1, '1000'), job('b', 'quoted', 1)], new Map());
    expect(s).toEqual({ count: 2, total: 1000, priced: 1, weighted: 400, quietAfterDays: 14 });
    const inv = new Map([['c', { count: 1, totalAmount: 3920 }]]);
    expect(columnSummary('invoiced', [job('c', 'invoiced', 1)], inv).weighted).toBe(3136);
  });
  it('up next: gone quiet first, by value then age', () => {
    const jobs = [job('a', 'quoted', 1, '9000'), job('b', 'quoted', 30, '100'), job('c', 'enquired', 5), job('d', 'quoted', 40, '5000')];
    expect(upNext(jobs, new Map(), NOW).map((g) => [g.group, g.jobs.map((j) => j.id)])).toEqual([
      ['quiet', ['d', 'b', 'c']],
      ['open', ['a']],
    ]);
  });
  it('filters by quiet and source', () => {
    const jobs = [job('a', 'enquired', 5, null, 'website'), job('b', 'enquired', 0, null, 'email')];
    expect(filterJobs(jobs, 'quiet', null, NOW).map((j) => j.id)).toEqual(['a']);
    expect(filterJobs(jobs, 'all', 'email', NOW).map((j) => j.id)).toEqual(['b']);
  });
});
