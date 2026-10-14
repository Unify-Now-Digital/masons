/**
 * Test / internal deals never count as real families: they are hidden from the
 * Today / other / revive / abandoned lists and excluded from the forecast.
 * Rule (checked against prod people rows 14 Oct 2026, SELECT-only):
 *   - people.is_test = true, or
 *   - email on an internal / reserved domain, or
 *   - a known staff person (name or email), or
 *   - a name or email local part containing a word starting "test" (word-bounded,
 *     so e.g. "Paola Farino" or "Margaret" never match).
 */
import type { PipelineJob } from '../types/jobsPipeline.types';

const INTERNAL_DOMAINS = ['unifynow.digital', 'searsmelvin.co.uk', 'searsmelvin.test', 'example.com'];
const STAFF_NAMES = ['arin melvin', 'matthew sears'];
const STAFF_EMAILS = ['arinmelvin@gmail.com', 'info@churchillmemorials.com'];
const TEST_WORD = /(^|[^a-z])test/i;

export function isTestPerson(p: { first_name?: string | null; last_name?: string | null; email?: string | null; is_test?: boolean | null } | null | undefined): boolean {
  if (!p) return false;
  if (p.is_test) return true;
  const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim().replace(/\s+/g, ' ').toLowerCase();
  const email = (p.email ?? '').trim().toLowerCase();
  const domain = email.split('@')[1] ?? '';
  if (domain && INTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  if (STAFF_NAMES.includes(name) || STAFF_EMAILS.includes(email)) return true;
  return TEST_WORD.test(name) || TEST_WORD.test(email.split('@')[0] ?? '');
}

export function isTestDeal(job: Pick<PipelineJob, 'person' | 'conversation'>): boolean {
  if (isTestPerson(job.person)) return true;
  const h = job.conversation?.primary_handle;
  return !!h && h.includes('@') && isTestPerson({ email: h });
}
