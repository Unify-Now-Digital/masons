import { describe, expect, it } from 'vitest';
import { getJobDisplayName } from './display';
import { dedupeBareJobs } from './dedupeJobs';
import type { PipelineJob } from '../types/jobsPipeline.types';

describe('QA fixes', () => {
  it('drops a "-" last name', () => {
    expect(getJobDisplayName({ person: { first_name: 'Dawn', last_name: '-' } } as unknown as PipelineJob)).toBe('Dawn (no surname)');
    expect(getJobDisplayName({ person: { first_name: 'Dean', last_name: '.' } } as unknown as PipelineJob)).toBe('Dean (no surname)');
    expect(getJobDisplayName({ person: { first_name: 'Dean', last_name: '.' } } as unknown as PipelineJob)).not.toBe('Dean .');
  });
  it('dedupes bare duplicate jobs per person, keeps enquiry jobs', () => {
    const j = (id: string, p: string | null, e: string | null, c: string) => ({ id, person_id: p, enquiry_id: e, created_at: c });
    const out = dedupeBareJobs([j('a', 'p1', null, '2026-10-01'), j('b', 'p1', null, '2026-10-03'), j('c', 'p1', 'e1', '2026-10-02'), j('d', null, null, '2026-10-01')]);
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'd']);
  });
});
